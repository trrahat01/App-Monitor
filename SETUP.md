# Play Store Analytics Monitor — Setup Guide

This repo is an **Android (Expo / React Native)** dashboard that monitors all of
your apps on the **Google Play Store** and shows **real** data:

- ✅ how many users **open / use** your app (active users + sessions)
- ✅ how many **install** your app
- ✅ how many **uninstall** your app
- ✅ one color per app
- ✅ `1D / 7D / 30D` windows
- ✅ backend hosted on **Render's free tier**, metrics from **Firebase / Play**

The app ships in a fully-working **DEMO mode** so you can run it today. To see
your **real** numbers you connect it to your Google Play + Firebase accounts.
The exact steps are below.

---

## 1) Run it right now (demo mode)

The mobile app needs no backend to run — it shows labeled demo data until it can
reach a backend.

```
pnpm --filter @workspace/firebase-analytics-mobile run dev     # Expo Go/Android preview
pnpm --filter @workspace/api-server run dev                    # backend on :5000 (optional)
pnpm run typecheck                                             # full typecheck
```

---

## 2) Deploy the backend to Render (free)

1. Sign in to [render.com](https://render.com) → **New → Web Service**.
2. Connect this repo, or copy the `api-server` package.
3. Leave **Root Directory** empty so Render sees `pnpm-workspace.yaml`.
4. Set:
   - **Build Command**: `pnpm --filter @workspace/api-server run build`
   - **Start Command**: `pnpm --filter @workspace/api-server run start`
   - **Runtime / Node**: choose a Node `>= 20` (Render free instance)
5. Render sets `PORT` automatically. Deploy.
6. Note your URL, e.g. `https://your-app.onrender.com`.
   Test it: `GET https://your-app.onrender.com/api/overview?range=30D`

> If Render can't run `pnpm` (Node version or memory), either use a Node >= 20
> runtime or run the server anywhere free (e.g. a free Replit host) and forward
> the same `api/*` endpoints. The mobile app only needs those 3 endpoints.

---

## 3) Get real Firebose / Play data (your action items)

The app shows real numbers as soon as the **backend** can reach Google with your
credentials. You must create these (I can't create accounts on your behalf):

**A. Google Cloud service account**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a
   project for your store (or reuse your Firebase project).
2. **APIs & Services → Enable**: `Google Play Reporting API`
   `Android Publisher API` (and `Analytics Data API` if using Firebase GA4).
3. **APIs & Services → Credentials → Create Credentials → Service Account**.
4. Generate a **JSON key** and download it.
5. In **Play Console** → **Users & permissions > API access**, link that service
   account so it can read your apps' reporting.
6. In **Firebase console** → **Project settings → Service accounts**, add the
   service account so it can read your Firebase/analytics data.
7. In the **service account JSON**, copy the whole file contents.

**B) Tell the backend your apps**
In Render, set env `PLAY_APPS` to the apps you monitor (substitute for your own):

```json
[
  {"id":"myapp","name":"My App","category":"Games","packageName":"com.me.myapp","color":"#FF755C","enabled":true,"status":"Live"},
  {"id":"myapp2","name":"Second App","category":"Education","packageName":"com.me.app2","color":"#6ED6B2","enabled":true,"status":"Live"}
]
```

**C. Choose real metric sources (install/uninstall vs opens/active)**

The dashboard pipeline is structured so each metric can go live independently:

| metric | source |
| --- | --- |
| activeUsers / sessions | Firebase (GA4) → feed `PLAY_STATS_URL` or export a daily summary |
| installs / uninstalls | Play Console → export reports / feed `PLAY_STATS_URL` |

The two common free paths:

- **Play Console → Reporting → BigQuery** export for **installs / uninstalls**.
  Then expose (or poll) those numbers as `PLAY_STATS_URL`.
- **Firebase / GA4 → Analytics Data API** for **active users / opens**.
  The service uses a Google service-account token to call it (`GOOGLE_SERVICE_ACCOUNT_JSON`).

`render.yaml` declares these env vars; you set them on Render.

**C. Point the Android app at your backend**

Open `constants/config.ts` and set:

```ts
export const API_BASE_URL = 'https://your-app.onrender.com/api';
```

or set the Expo env var `EXPO_PUBLIC_API_URL` to that URL at build time.

When the app can reach the backend and it reports `dataSource: "live"`, every
screen switches from **DEMO** to **LIVE**.

---

## 4) Install / ship the Android binary

This is an Expo app, so you target Android natively:

1. `pnpm --filter @workspace/firebase-analytics-mobile run build` → produces a
   static Expo Go bundle you run on a device, **or** open the folder with Expo Go
   (scan the QR from `pnpm run dev`).
2. For a store-ready `.apk`/standalone binary, open this folder in a local
   Expo project and run `expo prebuild` / `expo export:embed` then build with
   Android Studio, or use Expo EAS build. That produces the actual Android app.

---

## Free-tier limits (what stays free)

- **Firebase Spark** plan: free daily usage for analytics events (rate-limited).
- **Play Console reporting API**: free API calls (within Google quotas).
- **Render free**: one web service; it sleeps when idle, then wakes on first hit.
  The mobile app then just waits a few seconds on first load after it sleeps.
- No paid service is required for this build.

---

## If something doesn't show as live

| symptom | fix |
| --- | --- |
| Still “DEMO” with a backend | `GOOGLE_SERVICE_ACCOUNT_JSON` or `PLAY_STATS_URL` empty → add them |
| 401/403 from Google | service account not linked in Play Console / Firebase, or scope missing |
| Blank lists end | `PLAY_APPS` env empty; the server defaults to demo names |
| Backend returns 400 on range | pass `range=1D|7D|30D` only |

Report any error back and it will be fixed — full typecheck + build are
`pnpm run typecheck` / `pnpm run build`.