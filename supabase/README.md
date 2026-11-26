# BECOMING v0.4 — Supabase setup

## 1. Database (required, free) — once
1. Supabase Dashboard → your project → **SQL Editor** → **New query**
2. Paste everything in [`schema.sql`](./schema.sql) → **Run**
   (safe to run again; it creates 5 tables, each locked with Row Level Security)

## 2. Login links (required, free) — once
Dashboard → **Authentication → URL Configuration**
- **Site URL**: `https://natnabyrinrise.github.io/becoming/`
- **Redirect URLs** → add: `https://natnabyrinrise.github.io/becoming/**`

(Email confirmation is on by default: after "สร้างบัญชี", open the link in the email.)

## 3. Read data from images (optional — costs money per image)
The AI key stays on Supabase, never in the app.
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref ddczmwjjecqobxnbcjqf
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # from console.anthropic.com
# optional:
supabase secrets set CAPTURE_MODEL=claude-haiku-5-5    # much cheaper; default is claude-opus-5-5
supabase secrets set CAPTURE_DAILY_LIMIT=20            # images per user per day
supabase functions deploy extract-capture
```
Until this is deployed, the "อ่านจากภาพ" screen shows that it isn't enabled yet. Everything else works without it.
