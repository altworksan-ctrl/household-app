# Setting up push notifications

This is the one part of the app that needs real infrastructure — a scheduled
job running on Supabase's servers, independent of the app being open. It's
all free, but needs to be deployed by you from a terminal. Follow these in
order.

## 1. Generate your VAPID keys

VAPID keys are what let your server prove to browsers that push messages
really came from your app. Generate your own — don't use anyone else's.

```
npx web-push generate-vapid-keys
```

This prints a **Public Key** and a **Private Key**. Save both somewhere safe
(a notes app) — you'll use them in steps 3 and 4.

## 2. Add the public key to your app

In your `.env` (local) and in **Vercel → Settings → Environment Variables**
(for the live site), add:

```
VITE_VAPID_PUBLIC_KEY=<the public key from step 1>
```

Redeploy on Vercel after adding it (`vercel --prod`, or just push a commit —
Vercel auto-redeploys).

## 3. Install the Supabase CLI and log in

```
npm install -g supabase
supabase login
```

This opens a browser to authenticate. From your project folder, link it to
your Supabase project (find your project ref in the Supabase dashboard URL,
e.g. `nmrojpywuzvfefqpkwlz`):

```
supabase link --project-ref nmrojpywuzvfefqpkwlz
```

## 4. Set the function's secrets

The private VAPID key must **never** go in your app's `.env` or Vercel env
vars — it's server-only. Set it directly on Supabase instead:

```
supabase secrets set VAPID_PUBLIC_KEY="<public key from step 1>"
supabase secrets set VAPID_PRIVATE_KEY="<private key from step 1>"
supabase secrets set VAPID_SUBJECT="mailto:you@example.com"
supabase secrets set CRON_SECRET="<make up any long random string>"
```

`CRON_SECRET` is just a shared password between the cron job and the
function, so nobody else can trigger it by guessing the URL. Any random
string works — e.g. generate one with `openssl rand -hex 24`.

## 5. Deploy the function

```
supabase functions deploy daily-notifications --no-verify-jwt
```

`--no-verify-jwt` is needed because this function is called by a scheduled
job, not a logged-in user — the `CRON_SECRET` check inside the function is
what keeps it locked down instead.

After deploying, note your function's URL — it'll look like:
```
https://nmrojpywuzvfefqpkwlz.functions.supabase.co/daily-notifications
```

## 6. Schedule it to run daily

In Supabase, go to **Database → Extensions** and enable both:
- `pg_cron`
- `pg_net`

Then in **SQL Editor**, run (replace the URL and secret with your own):

```sql
select cron.schedule(
  'daily-household-notifications',
  '0 8 * * *',  -- 8:00 AM UTC every day — adjust to your household's timezone
  $$
  select net.http_post(
    url := 'https://nmrojpywuzvfefqpkwlz.functions.supabase.co/daily-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<your CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

**On the time**: `0 8 * * *` means 8:00 AM UTC. If your household is in, say,
UK time, that's 8/9 AM local depending on daylight saving — adjust the hour
to whenever you want the daily nudge to land. This is a single fixed time
for the whole household (not per-person timezones).

## 7. Each housemate turns notifications on

This part's just in the app — no terminal needed. In the **Me** tab,
everyone taps **"Turn on"** under *Rota & rent reminders*. The browser will
ask for notification permission — they need to accept it.

**Important for iPhone users**: Safari only allows push notifications for
sites added to the Home Screen (Share → Add to Home Screen) — a normal
Safari tab can't receive them at all. Android/Chrome doesn't have this
restriction. Make sure iPhone housemates do this step first, or the
"Turn on" button won't work for them.

## Testing it without waiting for tomorrow morning

You can trigger the function manually anytime to test it, using curl:

```
curl -X POST https://nmrojpywuzvfefqpkwlz.functions.supabase.co/daily-notifications \
  -H "x-cron-secret: <your CRON_SECRET>" \
  -H "Content-Type: application/json"
```

It'll return something like `{"ok":true,"notificationsSent":3}` and anyone
subscribed with a rota entry today (or unpaid rent on the 1st/25th) should
get a real notification within seconds.

## What it actually sends

- **Rota**: whoever's cooking/cleaning **today**, based on the saved rota —
  only days the admin has generated/saved will trigger this (unsaved,
  auto-computed-on-view days won't), so make sure a few months are
  generated ahead of time in the Rota tab.
- **Rent/WiFi**: on the 1st and 25th of each month, anyone (non-admin) with
  rent or WiFi still marked unpaid for that month gets a nudge.

Want the reminder days or wording changed? Edit
`supabase/functions/daily-notifications/index.ts` and redeploy with the
same `supabase functions deploy` command from step 5.
