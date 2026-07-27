// Supabase Edge Function — runs once a day (via cron, see README)
// - Notifies today's cook and cleaner for every household
// - On the 1st and 25th of the month, nudges anyone with unpaid rent/WiFi
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
      // subscription is gone (browser cleared it, uninstalled, etc.) — remove it
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (CRON_SECRET) {
    const header = req.headers.get("x-cron-secret");
    if (header !== CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const today = new Date();
  const dateKey = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
  const monthKey = dateKey.slice(0, 7);
  const dayOfMonth = today.getUTCDate();

  const { data: households } = await supabase.from("households").select("id, name");
  let notificationsSent = 0;

  for (const hh of households ?? []) {
    // --- rota reminder ---
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

    // --- rent / wifi reminder (1st and 25th of the month) ---
    if (dayOfMonth === 1 || dayOfMonth === 25) {
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
  }

  return new Response(JSON.stringify({ ok: true, notificationsSent }), {
    headers: { "Content-Type": "application/json" },
  });
});
