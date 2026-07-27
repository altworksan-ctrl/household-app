// Supabase Edge Function
// Two ways to call this:
//  1. Cron (scheduled) — header "x-cron-secret" matches CRON_SECRET.
//     Runs across ALL households. Used for the daily rota/payment jobs.
//  2. Admin, from the app — a real logged-in admin's session token
//     (sent automatically by supabase.functions.invoke()). Scoped to
//     ONLY that admin's own household — they can't trigger anyone else's.
//
// Body: { type: "rota" | "payments" | "expense" | "all", force?: boolean,
//         expenseDescription?: string, expenseAmount?: number }
//
// Required secrets (set with `supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const pad = (n) => String(n).padStart(2, "0");

async function notifyMember(memberId, title, body) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("member_id", memberId);
  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body })
      );
      sent++;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // --- authorize: either the cron secret, or a real admin's session ---
  let scopedHouseholdId = null; // null = unrestricted (cron path only)
  let authorized = false;

  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    authorized = true;
  } else {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const jwt = authHeader.slice(7);
      const { data: userData } = await supabase.auth.getUser(jwt);
      if (userData?.user?.email) {
        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("email", userData.user.email)
          .eq("is_admin", true)
          .maybeSingle();
        if (member) {
          authorized = true;
          scopedHouseholdId = member.household_id; // admins can only trigger their own household
        }
      }
    }
  }

  if (!authorized) {
    return new Response("Unauthorized", { status: 401, headers: CORS_HEADERS });
  }

  let type = "all";
  let force = false;
  let expenseDescription = "a new expense";
  let expenseAmount = null;
  try {
    const body = await req.json();
    if (body?.type) type = body.type;
    if (body?.force === true) force = true;
    if (body?.expenseDescription) expenseDescription = body.expenseDescription;
    if (typeof body?.expenseAmount === "number") expenseAmount = body.expenseAmount;
  } catch {
    // no body — default to "all", useful for manual cron testing
  }

  const today = new Date();
  const dateKey = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  const monthKey = dateKey.slice(0, 7);
  const dayOfMonth = today.getUTCDate();

  let householdsQuery = supabase.from("households").select("id, name");
  if (scopedHouseholdId) householdsQuery = householdsQuery.eq("id", scopedHouseholdId);
  const { data: households } = await householdsQuery;

  let notificationsSent = 0;

  for (const hh of households ?? []) {
    // --- rota reminder ---
    if (type === "rota" || type === "all") {
      const { data: rotaEntry } = await supabase
        .from("rota_entries")
        .select("*")
        .eq("household_id", hh.id)
        .eq("date", dateKey)
        .maybeSingle();

      if (rotaEntry) {
        if (rotaEntry.cook_id) {
          notificationsSent += await notifyMember(
            rotaEntry.cook_id,
            "🍳 You're cooking today",
            `Today's your turn to cook at ${hh.name}.`
          );
        }
        if (rotaEntry.clean_id && rotaEntry.clean_id !== rotaEntry.cook_id) {
          notificationsSent += await notifyMember(
            rotaEntry.clean_id,
            "🧹 You're cleaning today",
            `Today's your turn to clean at ${hh.name}.`
          );
        }
      }
    }

    // --- rent / wifi reminder (1st and 25th of the month, or forced) ---
    if ((type === "payments" || type === "all") && (force || dayOfMonth === 1 || dayOfMonth === 25)) {
      const { data: members } = await supabase
        .from("members")
        .select("*")
        .eq("household_id", hh.id)
        .eq("active", true)
        .eq("is_admin", false);

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("household_id", hh.id)
        .eq("month", monthKey);

      const paymentByMember = Object.fromEntries((payments ?? []).map((p) => [p.member_id, p]));

      for (const m of members ?? []) {
        const p = paymentByMember[m.id];
        const rentDone = p?.rent_paid ?? false;
        const wifiDone = p?.wifi_paid ?? false;
        if (!rentDone || !wifiDone) {
          const missing = [!rentDone && "rent", !wifiDone && "WiFi"].filter(Boolean).join(" & ");
          notificationsSent += await notifyMember(
            m.id,
            "💷 Payment reminder",
            `Your ${missing} for ${hh.name} is still marked unpaid.`
          );
        }
      }
    }

    // --- new expense notification ---
    if (type === "expense") {
      const { data: members } = await supabase
        .from("members")
        .select("*")
        .eq("household_id", hh.id)
        .eq("active", true);

      const activeCount = (members ?? []).length;
      const monthStart = `${monthKey}-01`;
      const nextMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
      const monthEnd = `${nextMonth.getUTCFullYear()}-${pad(nextMonth.getUTCMonth() + 1)}-01`;

      const { data: expenses } = await supabase
        .from("expenses")
        .select("*")
        .eq("household_id", hh.id)
        .gte("date", monthStart)
        .lt("date", monthEnd);

      const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
      const share = activeCount ? total / activeCount : 0;

      for (const m of members ?? []) {
        if (m.is_admin) continue;
        const paid = (expenses ?? [])
          .filter((e) => e.member_id === m.id)
          .reduce((s, e) => s + Number(e.amount), 0);
        const owed = Math.max(0, share - paid);
        const amountText = expenseAmount != null ? `£${expenseAmount.toFixed(2)} added for ${expenseDescription}. ` : "";
        notificationsSent += await notifyMember(
          m.id,
          "🛒 New grocery expense",
          `${amountText}You now owe £${owed.toFixed(2)} this month.`
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, type, notificationsSent }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
