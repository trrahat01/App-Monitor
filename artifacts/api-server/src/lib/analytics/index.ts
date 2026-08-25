import type {
  ManagedApp,
  Range,
  OverviewResponse,
  InsightsResponse,
  PortfolioResponse,
  AppAnalytics,
} from "./types.ts";
import { fetchGa4DailyReport, fetchPlayStats, daysAgoIso } from "./playstore.ts";
import { computeStreak, seedTestersHistory } from "./closedTesting.ts";

seedTestersHistory(process.env.TESTERS_HISTORY);

export { RANGES, isRange } from "./types.ts";
export type { Range } from "./types.ts";
export type {
  ManagedApp,
  OverviewResponse,
  InsightsResponse,
  PortfolioResponse,
  AppAnalytics,
} from "./types";

const TTL_MS = 60_000;

/** Fallback palette used when MONITOR_APPS doesn't specify a color. */
const FALLBACK_COLORS = ["#FF755C", "#6ED6B2", "#A78BFA", "#F6B85C", "#4FC3F7", "#F48FB1", "#81C784", "#BA8AF5"];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

/**
 * Reads the app registry from `MONITOR_APPS` (the env var name used on Render,
 * shaped as [{name, packageId, propertyId}]) with `PLAY_APPS` as a fallback.
 * Returns an empty list — never fabricated apps.
 */
function configuredApps(): ManagedApp[] {
  const raw = process.env.MONITOR_APPS || process.env.PLAY_APPS;
  let envApps: ManagedApp[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) {
        envApps = parsed.map((entry, index): ManagedApp => {
          const e = (entry ?? {}) as Record<string, unknown>;
          const hasFull = typeof e.id === "string" && typeof e.packageName === "string" && typeof e.color === "string";
          if (hasFull) {
            return {
              id: e.id as string,
              name: (e.name as string) ?? (e.id as string),
              category: (e.category as string) ?? "Apps",
              packageName: e.packageName as string,
              color: e.color as string,
              enabled: e.enabled !== false,
              status: (e.status as string) ?? "Live · GA4 syncing",
              firebaseProjectId: (e.firebaseProjectId as string) ?? undefined,
              gaPropertyId: (e.gaPropertyId as string) ?? undefined,
            };
          }
          const name = (e.name as string) ?? `App ${index + 1}`;
          const packageName = (e.packageId as string) ?? (e.packageName as string) ?? "";
          return {
            id: slugify(name),
            name,
            category: (e.category as string) ?? "Apps",
            packageName,
            color: (e.color as string) ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
            enabled: true,
            status: "Live · GA4 syncing",
            firebaseProjectId: (e.firebaseProjectId as string) ?? undefined,
            gaPropertyId: (e.propertyId as string) ?? (e.gaPropertyId as string) ?? undefined,
          };
        });
      }
    } catch {
      // ignore malformed env and fall through to runtime apps
    }
  }
  return [...envApps, ...runtimeApps];
}

function liveMode(): boolean {
  // Live is possible when we have real credentials AND at least one app maps to
  // a GA4 property (for opens/sessions). Installs/uninstalls additionally need
  // a Play-report source. We never report fabricated numbers.
  const hasCreds = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  return Boolean(hasCreds && configuredApps().some((a) => a.gaPropertyId));
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

const overviewCache = new Map<Range, CacheEntry<OverviewResponse>>();
const insightsCache = new Map<Range, CacheEntry<InsightsResponse>>();

function fresh<T>(entry: CacheEntry<T> | undefined): boolean {
  return Boolean(entry && Date.now() - entry.at < TTL_MS);
}

export async function getPortfolio(): Promise<PortfolioResponse> {
  const apps = configuredApps();
  const live = liveMode();
  const current: ManagedApp[] = apps.map((app) => ({
    ...app,
    status: live ? "Live · syncing Play reporting" : app.status,
  }));
  return {
    apps: current,
    dataSource: live ? "live" : "offline",
    lastSyncedAt: live ? new Date().toISOString() : null,
  };
}

/** Apps registered at runtime via POST /api/apps (in-memory). */
const runtimeApps: ManagedApp[] = [];

let paletteIndex = 0;

export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
}

export function addMonitoredApp(input: {
  name: string;
  packageName: string;
  gaPropertyId: string;
  color?: string;
  category?: string;
}): ManagedApp {
  const app: ManagedApp = {
    id: slugifyName(input.name),
    name: input.name,
    category: input.category ?? "Apps",
    packageName: input.packageName,
    color: input.color ?? FALLBACK_COLORS[paletteIndex++ % FALLBACK_COLORS.length],
    enabled: true,
    status: "Live · GA4 syncing",
    gaPropertyId: input.gaPropertyId,
  };
  runtimeApps.push(app);
  return app;
}

function rangeDays(range: Range): number {
  return range === "1D" ? 1 : range === "7D" ? 7 : 30;
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

/** Last N calendar dates (YYYY-MM-DD), oldest → newest. */
function dateLabels(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(daysAgoIso(i));
  return out;
}

const ZERO_METRICS = { activeUsers: 0, sessions: 0, installs: 0, uninstalls: 0, testers: 0, crashes: 0, anrs: 0, crashFreeRate: 0 };

interface BuildResult {
  app: AppAnalytics;
  live: boolean;
}

/**
 * Builds one app's analytics. When the service account + a GA4 property id are
 * present it pulls real daily opens/sessions; otherwise every metric is 0 and
 * the app is marked non-live. Installs/uninstalls come from PLAY_STATS_URL when
 * provided, else stay 0 (never fabricated).
 */
async function buildAppAnalytics(app: ManagedApp, range: Range): Promise<BuildResult> {
  const n = rangeDays(range);
  const labels = dateLabels(n);
  const activeUsers = Array<number>(n).fill(0);
  const sessions = Array<number>(n).fill(0);

  let live = false;
  const hasCreds = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  if (app.gaPropertyId && hasCreds) {
    const pts = await fetchGa4DailyReport(app.gaPropertyId, daysAgoIso(n - 1), daysAgoIso(0));
    if (pts && pts.length > 0) {
      const byDate = new Map(pts.map((p) => [p.date, p]));
      labels.forEach((d, i) => {
        const pt = byDate.get(d);
        if (pt) {
          activeUsers[i] = pt.activeUsers;
          sessions[i] = pt.sessions;
        }
      });
      live = activeUsers.some((v) => v > 0) || sessions.some((v) => v > 0);
    }
  }

  let installs = 0;
  let uninstalls = 0;
  let testers = 0;
  let crashes = 0;
  let anrs = 0;
  let crashFreeRate = 0;
  if (process.env.PLAY_STATS_URL) {
    const stats = await fetchPlayStats(process.env.PLAY_STATS_URL);
    if (stats) {
      installs = stats.installs ?? 0;
      uninstalls = stats.uninstalls ?? 0;
      testers = stats.testers ?? 0;
      crashes = stats.crashes ?? 0;
      anrs = stats.anrs ?? 0;
      crashFreeRate = stats.crashFreeRate ?? (crashes + anrs > 0 ? 0 : 100);
    }
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const appLive = live;

  // Play closed-testing policy with streak-reset logic: ≥12 testers for ≥14
  // CONSECUTIVE days. If a day drops below 12, the streak resets to 0.
  const streak = computeStreak(app.id, testers);
  const closedTesting = {
    testers: streak.testers,
    daysAt12Plus: streak.daysAt12Plus,
    requiredDays: streak.requiredDays,
    compliant: streak.compliant,
    targetDate: streak.targetDate,
    resetToday: streak.resetToday,
    lastChecked: streak.lastChecked,
    history: streak.history,
  };

  return {
    app: {
      appId: app.id,
      range,
      name: app.name,
      category: app.category,
      color: app.color,
      dataSource: appLive ? "live" : "offline",
      liveAt: appLive ? new Date().toISOString() : null,
      totals: { activeUsers: sum(activeUsers), sessions: sum(sessions), installs, uninstalls, testers, crashes, anrs, crashFreeRate },
      closedTesting,
      changes: ZERO_METRICS,
      retentionDay1: 0,
      retentionDay7: 0,
      rating: 0,
      trend: { labels, activeUsers, sessions, installs: zeros(n), uninstalls: zeros(n) },
    },
    live: appLive,
  };
}

/** Builds labels + merged series for a set of per-app results. */
function mergeOverview(apps: AppAnalytics[]): OverviewResponse["trend"] {
  const n = apps[0]?.trend.activeUsers.length ?? 0;
  const labels = apps[0]?.trend.labels ?? dateLabels(n);
  const col = (pick: (a: AppAnalytics) => number[]) => {
    const out = new Array<number>(n).fill(0);
    for (const a of apps) {
      const v = pick(a);
      for (let i = 0; i < n; i += 1) out[i] += v[i] ?? 0;
    }
    return out;
  };
  return {
    labels,
    activeUsers: col((a) => a.trend.activeUsers),
    sessions: col((a) => a.trend.sessions),
    installs: col((a) => a.trend.installs),
    uninstalls: col((a) => a.trend.uninstalls),
  };
}

export async function getOverview(range: Range): Promise<OverviewResponse> {
  const cached = overviewCache.get(range);
  if (cached && fresh(cached)) return cached.value;

  const registry = configuredApps();

  if (registry.length === 0) {
    const labels = dateLabels(rangeDays(range));
    const empty: OverviewResponse = {
      range,
      dataSource: "offline",
      lastSyncedAt: null,
      totals: ZERO_METRICS,
      changes: ZERO_METRICS,
      trend: { labels, activeUsers: zeros(labels.length), sessions: zeros(labels.length), installs: zeros(labels.length), uninstalls: zeros(labels.length) },
      apps: [],
    };
    overviewCache.set(range, { at: Date.now(), value: empty });
    return empty;
  }

  const built = [];
  for (const app of registry) built.push(await buildAppAnalytics(app, range));
  const apps = built.map((b) => b.app);
  const live = built.some((b) => b.live) || Boolean(process.env.PLAY_STATS_URL && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const sum = (pick: (a: AppAnalytics) => number) => apps.reduce((acc, a) => acc + pick(a), 0);
  const response: OverviewResponse = {
    range,
    dataSource: live ? "live" : "offline",
    lastSyncedAt: live ? new Date().toISOString() : null,
    totals: {
      activeUsers: sum((a) => a.totals.activeUsers),
      sessions: sum((a) => a.totals.sessions),
      installs: sum((a) => a.totals.installs),
      uninstalls: sum((a) => a.totals.uninstalls),
      testers: sum((a) => a.totals.testers),
      crashes: sum((a) => a.totals.crashes),
      anrs: sum((a) => a.totals.anrs),
      crashFreeRate: apps.length ? Math.round(apps.reduce((acc, a) => acc + a.totals.crashFreeRate, 0) / apps.length * 10) / 10 : 0,
    },
    changes: ZERO_METRICS,
    trend: mergeOverview(apps),
    apps,
  };

  overviewCache.set(range, { at: Date.now(), value: response });
  return response;
}

export async function getInsights(range: Range): Promise<InsightsResponse> {
  const cached = insightsCache.get(range);
  if (cached && fresh(cached)) return cached.value;

  const registry = configuredApps();
  const live = liveMode();
  const empty: InsightsResponse = {
    range,
    dataSource: live ? "live" : "offline",
    lastSyncedAt: live ? new Date().toISOString() : null,
    retention: { day1: 0, day7: 0, day14: 0, day30: 0 },
    countries: [],
    uninstallsByApp: registry.map((app) => ({ appId: app.id, name: app.name, color: app.color, uninstalls: 0, rate: 0 })),
  };
  insightsCache.set(range, { at: Date.now(), value: empty });
  return empty;
}