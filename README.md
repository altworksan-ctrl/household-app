# Household

Mobile-first shared-house manager: chore rota, grocery expense splitter, and
a private rent/WiFi status check — built on React + Supabase (auth + database
+ row-level security).

## What's already done
- Database schema + Row Level Security policies (you ran these in the
  Supabase SQL Editor)
- Magic-link login (no passwords) with sessions that persist indefinitely on
  each device — sign in once, stay signed in
- Rent/WiFi status is enforced private at the **database** level: a
  non-admin's query for the `payments` table can only ever return their own
  row, regardless of what the app's front-end code does

## Run it locally first (recommended)

1. Install [Node.js](https://nodejs.org) if you don't have it (v18+).
2. In this folder:
   ```
   npm install
   cp .env.example .env
   ```
3. Open `.env` and fill in your Supabase values (Project Settings → API in
   your Supabase dashboard):
   ```
   VITE_SUPABASE_URL=https://nmrojpywuzvfefqpkwlz.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_iQrdyF1iCeOXalZWQh8n7Q_tv-Fx3jm
   ```
4. In Supabase: **Authentication → URL Configuration** — set **Site URL** to
   `http://localhost:5173` for now (you'll add your real domain after
   deploying).
5. Run it:
   ```
   npm run dev
   ```
   Open the printed `localhost` URL on your phone (same WiFi) or in your
   browser, and try logging in with your own email.

## Deploy to Vercel (free)

**Option A — no GitHub needed (fastest):**
1. Install the Vercel CLI: `npm install -g vercel`
2. From this project folder, run: `vercel`
3. Follow the prompts (link/create a Vercel account, accept defaults).
4. When it asks about environment variables, or once deployed, go to your
   project on [vercel.com](https://vercel.com) → **Settings → Environment
   Variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy so the env vars take effect: `vercel --prod`

**Option B — via GitHub (better for future updates):**
1. Push this folder to a new GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Add the same two environment variables in the import screen.
4. Deploy.

## After deploying — final Supabase step

Vercel will give you a URL like `https://household-app-yourname.vercel.app`.
Go back to Supabase → **Authentication → URL Configuration** and set:
- **Site URL**: your Vercel URL
- **Redirect URLs**: add your Vercel URL here too

This is what makes the magic-link email actually redirect back into your
live app instead of localhost.

## Using it

1. Open the site, enter your email, click the link it emails you.
2. First person becomes admin automatically when they create the household.
3. Admin goes to **Me** tab → adds each housemate by name + email.
4. Each housemate opens the site on their own phone, signs in with their
   email the same way — they'll land straight in the household (no invite
   code needed, matched by email).
5. For best experience, tell iPhone users to add the site to their home
   screen (Share → Add to Home Screen) — this matters later if/when we add
   push notifications, since Safari tabs can't receive them but installed
   PWAs can.

## Exporting records

Admins can go to **Me** tab → **Export all records (Excel)** at any time to
download a spreadsheet with every housemate, every expense (with who paid
and whether a receipt is attached), the full rent/WiFi payment history, and
the saved chore rota — one sheet each. This is on-demand, not automatic;
see below for what a scheduled/automatic version would take.

## Real-time sync

All four tabs (Rota, Money, Status, and household/member changes) now sync
live across devices using Supabase Realtime — if your admin reshuffles the
rota or logs an expense, everyone else's screen updates within a second or
two, no refresh needed. This needs one SQL step; see the top of this repo's
setup history / your chat for the `alter publication supabase_realtime add
table ...` statements if you haven't run them yet.

## Push notifications

See **PUSH_NOTIFICATIONS.md** for the full setup — this one needs a
one-time deploy from your terminal (Supabase CLI + a scheduled function),
since it has to run independently of anyone having the app open.

## Not built yet (possible next steps)
- **Automatic scheduled backups** (e.g. a spreadsheet emailed to the admin
  every month without anyone opening the app) — needs a scheduled Supabase
  Edge Function plus the SMTP setup above to send it
- Passkey/biometric login as an extra layer on top of magic-link
