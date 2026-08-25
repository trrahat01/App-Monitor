import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 3000);
const RANGES = ["1D", "7D", "30D"];
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const DEFAULT_APPS = [
  { id: "spark", name: "Daily Spark", category: "Lifestyle", packageName: "com.dailyspark.quotes", color: "#FF755C", enabled: true, status: "Live · GA4 syncing", firebaseProjectId: "daily-quotes-5d950", gaPropertyId: "514861385" },
  { id: "nurse", name: "Nurse Exam Prep", category: "Education", packageName: "com.nurseexampreparation.nurse", color: "#6ED6B2", enabled: true, status: "Live · GA4 syncing", firebaseProjectId: "nurse-exam-cb96d", gaPropertyId: "550101857" },
  { id: "shiftsync", name: "ShiftSync Overtime", category: "Productivity", packageName: "com.trdevworks.shiftsync.app", color: "#A78BFA", enabled: true, status: "Live · GA4 syncing", firebaseProjectId: "work-out-54c16", gaPropertyId: "488888368" },
];

function parseApps() {
  const raw = process.env.PLAY_APPS;
  if (raw) { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : DEFAULT_APPS; } catch {} }
  return DEFAULT_APPS;
}
const APPS = parseApps();

// ---- Service account loading ----
function loadServiceAccount() {
  const fromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) {
    try { const p = JSON.parse(fromEnv); if (p.client_email && p.private_key) return p; } catch {}
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || "app-monitoring-506317-867da7db002c.json";
  try { const p = JSON.parse(fs.readFileSync(file, "utf8")); if (p.client_email && p.private_key) return p; } catch {}
  return null;
}
const SA = loadServiceAccount();

const tokenCache = { token: null, expiresAt: 0 };
function b64url(s) { return Buffer.from(s).toString("base64url").replace(/=+$/, ""); }
function signJws(payload, keyPem) {
  const header = { alg: "RS256", typ: "JWT" };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(input);
  return `${input}.${b64url(sign.sign(crypto.createPrivateKey(keyPem)))}`;
}
async function getAccessToken() {
  if (!SA) return null;
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJws(
    { iss: SA.client_email, scope: GA4_SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    SA.private_key
  );
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!res.ok) { console.error("oauth status", res.status); return null; }
    const j = await res.json();
    tokenCache.token = j.access_token;
    tokenCache.expiresAt = Date.now() + (j.expires_in || 3600) * 1000;
    return j.access_token;
  } catch (e) { console.error("oauth err", e.message); return null; }
}

async function ga4Daily(propertyId, startDate, endDate) {
  if (!propertyId || !SA) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      }),
    });
    if (!res.ok) { console.error("ga4 status", res.status, await res.text().catch(() => "")); return null; }
    const j = await res.json();
    if (!Array.isArray(j.rows)) return null;
    const map = {};
    for (const r of j.rows) {
      const raw = r.dimensionValues?.[0]?.value || "";
      // GA4 returns date dimension as YYYYMMDD — normalize to YYYY-MM-DD.
      const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      const mv = r.metricValues || [];
      map[date] = { activeUsers: Number(mv[0]?.value) || 0, sessions: Number(mv[1]?.value) || 0 };
    }
    return map;
  } catch (e) { console.error("ga4 err", propertyId, e.message); return null; }
}

function iso(daysAgo) { const d = new Date(); d.setUTCDate(d.getUTCDate() - daysAgo); return d.toISOString().slice(0, 10); }
function dateLabels(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(iso(i)); return out; }
const ZERO = { activeUsers: 0, sessions: 0, installs: 0, uninstalls: 0, testers: 0, crashes: 0, anrs: 0, crashFreeRate: 0 };

async function overview(range) {
  const n = range === "1D" ? 1 : range === "7D" ? 7 : 30;
  const lab = dateLabels(n);
  const apps = [];
  let anyLive = false;
  for (const app of APPS) {
    const data = await ga4Daily(app.gaPropertyId, iso(n - 1), iso(0));
    const activeUsers = lab.map((d) => (data && data[d] ? data[d].activeUsers : 0));
    const sessions = lab.map((d) => (data && data[d] ? data[d].sessions : 0));
    const hasData = activeUsers.some((v) => v > 0);
    if (hasData) anyLive = true;
    const testers = 0;
    apps.push({
      appId: app.id, range, name: app.name, category: app.category, color: app.color,
      dataSource: hasData ? "live" : "offline", liveAt: hasData ? new Date().toISOString() : null,
      totals: { activeUsers: activeUsers.reduce((a, b) => a + b, 0), sessions: sessions.reduce((a, b) => a + b, 0), installs: 0, uninstalls: 0, testers, crashes: 0, anrs: 0, crashFreeRate: 100 },
      closedTesting: { testers, daysAt12Plus: 2, requiredDays: 14, compliant: false, targetDate: "12 more days needed · 2 testers" },
      changes: ZERO, retentionDay1: 0, retentionDay7: 0, rating: 0,
      trend: { labels: lab, activeUsers, sessions, installs: new Array(n).fill(0), uninstalls: new Array(n).fill(0) },
    });
  }
  const col = (f) => {
    const out = new Array(n).fill(0);
    for (const a of apps) { const v = f(a); for (let i = 0; i < n; i++) out[i] += v[i] || 0; }
    return out;
  };
  return {
    range, dataSource: anyLive ? "live" : "offline", lastSyncedAt: anyLive ? new Date().toISOString() : null,
    totals: { activeUsers: apps.reduce((a, b) => a + b.totals.activeUsers, 0), sessions: apps.reduce((a, b) => a + b.totals.sessions, 0), installs: 0, uninstalls: 0, testers: 0, crashes: 0, anrs: 0, crashFreeRate: 100 },
    changes: ZERO,
    trend: { labels: lab, activeUsers: col((a) => a.trend.activeUsers), sessions: col((a) => a.trend.sessions), installs: new Array(n).fill(0), uninstalls: new Array(n).fill(0) },
    apps,
  };
}
function insights() {
  return { range: "30D", dataSource: "offline", lastSyncedAt: null, retention: { day1: 0, day7: 0, day14: 0, day30: 0 }, countries: [], uninstallsByApp: [] };
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  const range = RANGES.includes(params.get("range")) ? params.get("range") : "30D";
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("content-type", "application/json");
  const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body)); };
  try {
    if (path === "/api/healthz") return send(200, { status: "ok" });
    if (path === "/api/apps") return send(200, { apps: APPS, dataSource: SA ? "live" : "offline", lastSyncedAt: SA ? new Date().toISOString() : null });
    if (path === "/api/overview") return send(200, await overview(range));
    if (path === "/api/insights") return send(200, insights(range));
    send(404, { error: "not found" });
  } catch (e) { send(500, { error: e.message }); }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dev stats server on 0.0.0.0:${PORT} (service account: ${SA ? "loaded" : "NOT loaded"})`);
});