# BYU Scouting App – Deployment Steps

Deploy **backend first**, then point the frontend at it and redeploy the frontend.

---

## Phase 1: Deploy the backend (Express + PostgreSQL)

### 1.1 Choose a backend host

Use one of these (all support Node + env vars):

- **Render** (free tier): https://render.com  
- **Railway**: https://railway.app  
- **Fly.io**: https://fly.io  

Instructions below use **Render** as the example.

### 1.2 PostgreSQL in the cloud (if needed)

If your Postgres is only on your laptop, you need a hosted DB:

- **Render**: Dashboard → New → PostgreSQL. Copy the **Internal Database URL** (or External if you deploy elsewhere).
- **Neon**: https://neon.tech (free tier).
- **Supabase**: https://supabase.com (free Postgres).

You’ll use this as `DATABASE_URL` on the backend.

### 1.3 Create the backend service on Render

**Option A – Use the Blueprint (easiest)**

The repo has a `render.yaml` that defines the web service. After pushing the repo to GitHub:

1. Go to https://dashboard.render.com and sign in (e.g. with GitHub).
2. Click **New** → **Blueprint**.
3. Connect the GitHub account/repo if needed, then select the **ScoutingApp** repository.
4. Render will detect `render.yaml` and create a web service named `scouting-app-api` with Root Directory = `server`, Build = `npm install`, Start = `npm start`.
5. Click **Apply**. After the service is created, go to the service → **Environment** and add the env vars below.

**Option B – Create the Web Service manually**

1. Go to https://dashboard.render.com and sign in (e.g. with GitHub).
2. Click **New** → **Web Service**.
3. Connect your repo (push `ScoutingApp` to GitHub first if it’s not there) and select the **ScoutingApp** repo.
4. Set these exactly:
   - **Name:** `scouting-app-api` (or any name you like)
   - **Region:** pick one (e.g. Oregon)
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment** (or **Advanced** → **Add Environment Variable**), add:

   | Key             | Value |
   |-----------------|--------|
   | `NODE_ENV`      | `production` |
   | `DATABASE_URL`  | Your Postgres connection string (from 1.2) |
   | `JWT_SECRET`    | A long random string (e.g. from `openssl rand -hex 32`) |
   | `FRONTEND_URL`  | `https://recruiting-490120.web.app` |

   Optional (for emails, backup, etc.): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `APP_URL`, `BACKUP_ENCRYPTION_KEY`, coach emails. You can add these later.

6. Click **Create Web Service**. Wait until the deploy finishes.
7. Copy your backend URL, e.g. `https://scouting-app-api.onrender.com` (no `/api` on the end).

---

## Phase 2: Point the frontend at the backend and redeploy

### 2.1 Set the API URL for production builds

In the **project root** (same folder as `package.json`), create or edit `.env.production`:

```bash
VITE_API_URL=https://YOUR-BACKEND-URL/api
```

Replace `YOUR-BACKEND-URL` with the URL from step 1.3 (e.g. `https://scouting-app-api.onrender.com`).  
So the line might be:

```bash
VITE_API_URL=https://scouting-app-api.onrender.com/api
```

Do **not** put your Firebase Hosting URL here; that is the frontend.

### 2.2 Build the frontend

From the project root:

```bash
cd /Users/matthewvance/Desktop/BYUFootball/ScoutingApp
npm run build
```

This bakes `VITE_API_URL` into the built files in `dist/`.

### 2.3 Deploy the frontend to Firebase Hosting

From the same folder:

```bash
firebase deploy --only hosting
```

When it finishes, your app is live at **https://recruiting-490120.web.app** and it will call your deployed backend.

---

## Order summary

| Step | What | Command / action |
|------|------|-------------------|
| 1 | Deploy backend (Render/Railway/etc.) | Create Web Service, set env vars, deploy |
| 2 | Copy backend URL | e.g. `https://scouting-app-api.onrender.com` |
| 3 | Set API URL for production | Create `.env.production` with `VITE_API_URL=https://.../api` |
| 4 | Build frontend | `npm run build` |
| 5 | Deploy frontend | `firebase deploy --only hosting` |

---

## Later: making changes

- **Backend change:** push code, then redeploy the backend service (e.g. Render auto-deploys on push if connected to GitHub).
- **Frontend change:** run `npm run build` then `firebase deploy --only hosting`.
- **Env var change on backend:** update in Render (or your host) dashboard and redeploy.
- **New backend URL:** update `VITE_API_URL` in `.env.production`, run `npm run build`, then `firebase deploy --only hosting`.
