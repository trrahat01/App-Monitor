/**
 * Play closed-testing compliance with correct streak reset logic.
 *
 * Policy: app needs ≥12 testers opted in for ≥14 CONSECUTIVE days. If on any
 * single day the tester count drops below 12, the streak resets to 0.
 *
 * Daily tester snapshots are stored per app (keyed by YYYY-MM-DD). We keep them
 * in memory and also persist to a JSON file so they survive server restart in
 * the same container. Because these are manual/computed snapshots, they never
 * count as "live" GA4 data — they are tracked separately.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THRESHOLD_TESTERS = 12;
const REQUIRED_DAYS = 14;

type MapOf = Record<string, Record<string, number>>; // appId -> dateISO -> testers

// --- Persistence -----------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = process.env.TESTERS_HISTORY_FILE || path.resolve(__dirname, "..", "..", "..", "testers-history.json");

let store: MapOf = load();

function load(): MapOf {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as MapOf;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Disk may be read-only (e.g. some free hosts); in-memory still works.
  }
}

/** Seeds from the optional TESTERS_HISTORY env (JSON of appId -> date -> testers). */
export function seedTestersHistory(json: string | undefined): void {
  if (!json) return;
  try {
    const parsed = JSON.parse(json) as MapOf;
    if (parsed) store = parsed;
  } catch {
    // ignore
  }
}

/** Records today's (or given date's) tester count for an app. */
export function recordTesters(appId: string, testers: number, dateISO?: string): void {
  const date = dateISO ?? todayIso();
  store[appId] = store[appId] ?? {};
  store[appId][date] = testers;
  save();
}

export function getHistory(appId: string): Record<string, number> {
  return { ...(store[appId] ?? {}) };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoForDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface StreakResult {
  testers: number;
  daysAt12Plus: number;
  requiredDays: number;
  compliant: boolean;
  targetDate: string | null;
  /** True when the most recent counted day had <12 testers (streak broken/reset). */
  resetToday: boolean;
  /** Most recent date with a recorded snapshot. */
  lastChecked: string | null;
}

/**
 * Computes the current consecutive streak. Counts backward from today (or the
 * most recent recorded date) while each day has a RECORDED snapshot ≥12. The
 * streak stops (resets to 0) at the first missing day or any day below 12 —
 * matching Play's rule that a single sub-12 day resets the clock.
 */
export function computeStreak(appId: string, liveTesters: number): StreakResult {
  const history = getHistory(appId);
  const days: { date: string; testers: number | undefined }[] = [];

  // Build a dense recent window (last REQUIRED_DAYS + a little buffer).
  const windowDays = REQUIRED_DAYS + 7;
  for (let d = 0; d < windowDays; d += 1) {
    const date = isoForDaysAgo(d);
    days.push({ date, testers: history[date] });
  }

  // If today has no recorded snapshot, use the live (reported) tester count so
  // the current state is still reflected. But do NOT backfill earlier missing
  // days — a gap breaks the streak.
  const first = days[0];
  if (first.testers === undefined) first.testers = liveTesters;

  let streak = 0;
  for (const day of days) {
    // Missing snapshot = a gap -> the streak has already been reset.
    if (day.testers === undefined) break;
    if (day.testers < THRESHOLD_TESTERS) break;
    streak += 1;
  }

  const lastChecked = first.date;
  const resetToday = first.testers === undefined ? false : first.testers < THRESHOLD_TESTERS;
  const compliant = streak >= REQUIRED_DAYS;

  let targetDate: string | null = null;
  if (!compliant) {
    targetDate = isoForDaysAgo(Math.max(0, REQUIRED_DAYS - streak));
  }

  return {
    testers: first.testers ?? liveTesters,
    daysAt12Plus: streak,
    requiredDays: REQUIRED_DAYS,
    compliant,
    targetDate,
    resetToday,
    lastChecked,
  };
}