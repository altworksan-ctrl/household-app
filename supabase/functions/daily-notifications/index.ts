// Supabase Edge Function
// Two ways to call this:
//  1. Cron (scheduled) — header "x-cron-secret" matches CRON_SECRET.
//     Runs across ALL households.
//  2. Admin, from the app — a real logged-in admin's session token.
//     Scoped to ONLY that admin's own household.
//
// Body: { type: "rota" | "payments" | "expense" | "all", force?: boolean,
//         expenseDescription?: string, expenseAmount?: number }
//
// Every notification is logged to the `notifications` table (so the app's
// in-app history works) regardless of whether a push subscription exists —
// push delivery is best-effort on top of that.
//
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// CRON_SECRET. Optional: HOUSEHOLD_TIMEZONE (defaults to Europe/London).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const HOUSEHOLD_TIMEZONE = Deno.env.get("HOUSEHOLD_TIMEZONE") || "Europe/London";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const pad = (n) => String(n).padStart(2, "0");

function getLocalDateParts(timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return { dateKey: `${y}-${m}-${d}`, monthKey: `${y}-${m}`, dayOfMonth: Number(d) };
}

function nextMonthStart(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1)); // m is 1-indexed, so this rolls to next month
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;
}

async function computeOwed(householdId, monthKey) {
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true);
  const activeCount = (members ?? []).length;
  const monthStart = `${monthKey}-01`;
  const monthEnd = nextMonthStart(monthKey);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("household_id", householdId)
    .gte("date", monthStart)
    .lt("date", monthEnd);

  const { data: settlements } = await supabase
    .from("settlements")
    .select("*")
    .eq("household_id", householdId)
    .eq("month", monthKey);

  const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const share = activeCount ? total / activeCount : 0;

  const owedByMember = {};
  for (const m of members ?? []) {
    const paid = (expenses ?? []).filter((e) => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0);
    const settled = (settlements ?? []).filter((s2) => s2.member_id === m.id).reduce((s, s2) => s + Number(s2.amount), 0);
    owedByMember[m.id] = Math.max(0, share - paid - settled);
  }
  return { members: members ?? [], owedByMember };
}

async function notifyMember(householdId, memberId, title, body, kind) {
  const { data: inserted } = await supabase
    .from("notifications")
    .insert({ household_id: householdId, member_id: memberId, title, body, kind })
    .select()
    .single();

  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("member_id", memberId);
  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, notificationId: inserted?.id, kind })
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

  let scopedHouseholdId = null;
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
        const { data: memberRows } = await supabase
          .from("members")
          .select("*")
          .eq("email", userData.user.email)
          .eq("is_admin", true)
          .order("created_at", { ascending: false })
          .limit(1);
        const member = memberRows?.[0];
        if (member) {
          authorized = true;
          scopedHouseholdId = member.household_id;
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
    // no body — default to "all"
  }

  const { dateKey, monthKey, dayOfMonth } = getLocalDateParts(HOUSEHOLD_TIMEZONE);

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
            hh.id,
            rotaEntry.cook_id,
            "🍳 You're cooking today",
            `Today's your turn to cook at ${hh.name}.`,
            "rota"
          );
        }
        if (rotaEntry.clean_id && rotaEntry.clean_id !== rotaEntry.cook_id) {
          notificationsSent += await notifyMember(
            hh.id,
            rotaEntry.clean_id,
            "🧹 You're cleaning today",
            `Today's your turn to clean at ${hh.name}.`,
            "rota"
          );
        }
      }
    }

    // --- rent / wifi reminder (1st and 25th, or forced) ---
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
            hh.id,
            m.id,
            "💷 Payment reminder",
            `Your ${missing} for ${hh.name} is still marked unpaid.`,
            "payment"
          );
        }
      }
    }

    // --- new expense notification (triggered right after admin logs one) ---
    if (type === "expense") {
      const { members, owedByMember } = await computeOwed(hh.id, monthKey);
      for (const m of members) {
        if (m.is_admin) continue;
        const owed = owedByMember[m.id] ?? 0;
        const amountText = expenseAmount != null ? `£${expenseAmount.toFixed(2)} added for ${expenseDescription}. ` : "";
        notificationsSent += await notifyMember(
          hh.id,
          m.id,
          "🛒 New grocery expense",
          `${amountText}You now owe £${owed.toFixed(2)} this month.`,
          "expense"
        );
      }
    }

    // --- grocery balance reminder (only on the manual admin "send now") ---
    if (type === "all") {
      const { members, owedByMember } = await computeOwed(hh.id, monthKey);
      for (const m of members) {
        if (m.is_admin) continue;
        const owed = owedByMember[m.id] ?? 0;
        if (owed > 0.01) {
          notificationsSent += await notifyMember(
            hh.id,
            m.id,
            "🛒 Grocery balance reminder",
            `You currently owe £${owed.toFixed(2)} this month.`,
            "grocery-balance"
          );
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, type, notificationsSent }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
