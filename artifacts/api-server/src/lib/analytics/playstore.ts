import crypto from "node:crypto";

/**
 * Best-effort Google Cloud / Google Analytics / Play access client.
 *
 * This module NEVER throws. Every function returns null when the required
 * configuration is missing or the upstream call fails, so the analytics service
 * can transparently keep serving labeled demo data until real credentials are
 * mounted. These helpers are intentionally decoupled from the response shape so
 * the exact report endpoints can be tuned with environment variables.
 */

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
}

const OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url").replace(/=+$/u, "");
}

function signJws(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
): string {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(crypto.createPrivateKey(privateKeyPem));
  return `${signingInput}.${base64Url(signature)}`;
}

/**
 * Loads a service account. Reads `GOOGLE_APPLICATION_CREDENTIALS_JSON` (the
 * env var name used on Render) with `GOOGLE_SERVICE_ACCOUNT_JSON` as a fallback.
 */
export function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Returns a valid OAuth2 access token for the given scope, minting and caching
 * a fresh one when needed. Returns null when credentials or network fail.
 */
export async function getAccessToken(scope: string): Promise<string | null> {
  const account = loadServiceAccount();
  if (!account) return null;

  const cacheKey = `${account.client_email}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const assertion = signJws(header, payload, account.private_key);

  try {
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    const expiresInMs = (json.expires_in ?? 3600) * 1000;
    tokenCache.set(cacheKey, { token: json.access_token, expiresAt: Date.now() + expiresInMs });
    return json.access_token;
  } catch {
    return null;
  }
}

/** GETs a JSON payload from an authenticated Google endpoint. Returns null on failure. */
export async function googleFetchJson<T = unknown>(url: string, scope: string): Promise<T | null> {
  const token = await getAccessToken(scope);
  if (!token) return null;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Attempts to pull closed-testing + install stats from a Play-report endpoint.
 * The endpoint should return shape:
 *   { installs?, uninstalls?, testers?, crashes?, anrs?, crashFreeRate?, rating? }
 * Leave `PLAY_STATS_URL` unset to keep 0 for these (opens/active users still
 * work from GA4). Never fabricates numbers.
 */
export async function fetchPlayStats(url: string | undefined): Promise<{
  installs?: number;
  uninstalls?: number;
  testers?: number;
  crashes?: number;
  anrs?: number;
  crashFreeRate?: number;
  rating?: number;
} | null> {
  if (!url) return null;
  return googleFetchJson<{
    installs?: number;
    uninstalls?: number;
    testers?: number;
    crashes?: number;
    anrs?: number;
    crashFreeRate?: number;
    rating?: number;
  }>(url, PLAY_SCOPE);
}

export interface Ga4DailyPoint {
  /** YYYY-MM-DD */
  date: string;
  activeUsers: number;
  sessions: number;
}

/**
 * Pulls daily active-users + sessions from the GA4 Data API for a property over
 * an inclusive date range. Returns null when the property is unset or the call
 * (or credentials) fail — the caller keeps serving real-but-empty data then.
 */
export async function fetchGa4DailyReport(
  propertyId: string | undefined,
  startDate: string,
  endDate: string,
): Promise<Ga4DailyPoint[] | null> {
  if (!propertyId) return null;
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
  };
  const token = await getAccessToken(GA4_SCOPE);
  if (!token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
    };
    if (!Array.isArray(json.rows)) return null;
    return json.rows.map((row) => {
      const raw = row.dimensionValues?.[0]?.value ?? "";
      // GA4 returns date dimension as YYYYMMDD — normalize to YYYY-MM-DD.
      const date = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
      const [userStr = "0", sessionStr = "0"] = row.metricValues?.map((m) => m.value) ?? [];
      const users = Number(userStr) || 0;
      return { date, activeUsers: users, sessions: Number(sessionStr) || 0 };
    });
  } catch {
    return null;
  }
}

/** ISO (YYYY-MM-DD) date helper for offsets in days from today. */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}