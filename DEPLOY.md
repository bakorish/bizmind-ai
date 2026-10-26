# Deploying BizMind AI (free tier)

Architecture (per SRS §27 deployment): **Vercel** (frontend) + **Render** (backend + AI service) + **Neon** (PostgreSQL). All have free plans; total cost ৳0.

```
Browser -> https://your-app.vercel.app        (React, Vercel)
                |  https://bizmind-api.onrender.com/api   (Node/Express, Render)
                |        |     -> Neon PostgreSQL (DATABASE_URL)
                |        |     -> https://bizmind-ai.onrender.com (Python/FastAPI, Render)
```

## Step 0 — push to GitHub

```bash
cd D:\bizmind-ai
git remote add origin https://github.com/<your-username>/bizmind-ai.git
git push -u origin main
```
(Create the empty repo on github.com first. `.gitignore` already excludes node_modules, .env, databases.)

## Step 1 — PostgreSQL on Neon (free)

1. https://neon.com → sign up with GitHub → Create project (name: `bizmind`)
2. Dashboard → **Connection string** → copy the `postgresql://...` URL (keep the `-pooler` variant Neon offers)

Seed the demo data into it **from your machine** (one command, from `backend/`):

```bat
cd /d D:\bizmind-ai\backend
set DATABASE_URL=postgresql://<your-neon-url>
npm run seed
```

## Step 2 — backend services on Render (free)

1. https://dashboard.render.com → **New → Blueprint** → pick the `bizmind-ai` repo
   (`render.yaml` at repo root auto-creates both services)
2. When prompted, fill:
   - `bizmind-api` → `JWT_SECRET` (any long random string), `DATABASE_URL` (Neon URL), `AI_SERVICE_URL` = `https://bizmind-ai.onrender.com`, `CORS_ORIGIN` = your Vercel URL (step 3; you can add it later via Environment)
   - `bizmind-ai` → no vars needed
3. Apply → wait for both to build (~5 min). Free services sleep after 15 min idle; first request after sleep takes ~30-60s.

Check: `https://bizmind-api.onrender.com/api/health` → `{"status":"ok"}` and `https://bizmind-ai.onrender.com/health`.

## Step 3 — frontend on Vercel (free)

1. https://vercel.com → Continue with GitHub
2. **Add New → Project** → import `bizmind-ai` →
   - Framework Preset: **Vite** (auto-detected)
   - Root Directory: **frontend**
   - Build Command: `npm run build`, Output: `dist` (defaults)
   - Environment Variable: `VITE_API_URL` = `https://bizmind-api.onrender.com`
3. Deploy → open the `*.vercel.app` URL

## Step 4 — connect the last link

On Render → `bizmind-api` → Environment → set `CORS_ORIGIN` = the exact Vercel URL → save (auto-redeploys).

## Verify

- Open the Vercel URL → login `owner@bizmind.dev / password123`
- Dashboard KPIs should show numbers (API + DB connected)
- AI Insights tab → forecast loads (AI service connected; first load may take ~1 min while models train / service wakes)

## Notes & limits

- Free Render services sleep → first hit is slow; open the site 2-3 minutes before a demo
- If you re-seed later, remember `npm run seed` wipes and regenerates (sync force)
- Update code → `git push` → all three platforms redeploy automatically
- Everything works offline locally exactly as before (`.\start.bat`) — cloud is optional
