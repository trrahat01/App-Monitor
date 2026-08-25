/**
 * Shared analytics domain types used by the API routes (and mirrored by the
 * mobile client).
 *
 * These are intentionally plain JSON-safe values so the server layer stays
 * dependency-free (no runtime DB / ORM needed for the analytics endpoints).
 */

export const RANGES = ["1D", "7D", "30D"] as const;
export type Range = (typeof RANGES)[number];

export type DataSource = "live" | "offline" | "demo";

export function isRange(value: unknown): value is Range {
  return typeof value === "string" && (RANGES as readonly string[]).includes(value);
}

/** A single app the developer owns and wants to monitor. */
export interface ManagedApp {
  /** Stable id used to key analytics and pick a color. */
  id: string;
  /** Human friendly app name. */
  name: string;
  /** Play Store category (Lifestyle, Education, ...). */
  category: string;
  /** Android package name / bundle id e.g. com.example.app. */
  packageName: string;
  /** Brand color shown across the mobile dashboard. */
  color: string;
  enabled: boolean;
  /** Connection status shown on the Apps tab. */
  status: string;
  /** Optional Firebase analytics project id used to key live data per app. */
  firebaseProjectId?: string;
  /** Optional GA4 numeric property id (e.g. "3456789012") used to pull live opens/sessions. */
  gaPropertyId?: string;
}

/** Per-app metrics over a selected range. */
export interface AppAnalytics {
  appId: string;
  name: string;
  category: string;
  color: string;
  range: Range;
  dataSource: DataSource;
  /** ISO timestamp of the last successful live sync, or null when demo. */
  liveAt: string | null;
  totals: {
    /** Users who opened / used the app in the range. */
    activeUsers: number;
    sessions: number;
    installs: number;
    uninstalls: number;
    /** Number of testers in the Play Console closed-testing track. */
    testers: number;
    /** Count of crash reports (Android Vitals) in the range. */
    crashes: number;
    /** Count of ANRs (App Not Responding) in the range. */
    anrs: number;
    /** Crash-free user rate as a percentage (0-100). */
    crashFreeRate: number;
  };
  /** Play closed-testing policy progress (≥12 testers for ≥14 continuous days). */
  closedTesting: {
    /** Current number of testers opted in. */
    testers: number;
    /** Consecutive days with ≥12 testers. */
    daysAt12Plus: number;
    /** Days required by the Play policy (14). */
    requiredDays: number;
    /** Whether ≥12 testers have been opted in for ≥14 continuous days. */
    compliant: boolean;
    /** Estimated date the requirement will be met (null if not enough testers). */
    targetDate: string | null;
    /** True when the most recent day had <12 testers (streak broke/reset). */
    resetToday?: boolean;
    /** Most recent date with a recorded count. */
    lastChecked?: string | null;
    /** Last `requiredDays` days: date + testers + met status (for the calendar). */
    history?: { date: string; testers: number | null; met: boolean }[];
  };
  /** Percentage change for each metric relative to the previous equal period. */
  changes: {
    activeUsers: number;
    sessions: number;
    installs: number;
    uninstalls: number;
  };
  /** Day-1 retention percentage (0-100). */
  retentionDay1: number;
  /** 7-day retention percentage (0-100). */
  retentionDay7: number;
  /** Average store rating (0-5). */
  rating: number;
  /** Time series labels + metric series aligned by index. */
  trend: {
    labels: string[];
    activeUsers: number[];
    sessions: number[];
    installs: number[];
    uninstalls: number[];
  };
}

/** Aggregated response for the Overview screen. */
export interface OverviewResponse {
  range: Range;
  dataSource: DataSource;
  lastSyncedAt: string | null;
  /** Sum across every enabled app. */
  totals: {
    activeUsers: number;
    sessions: number;
    installs: number;
    uninstalls: number;
    testers: number;
    crashes: number;
    anrs: number;
    crashFreeRate: number;
  };
  changes: {
    activeUsers: number;
    sessions: number;
    installs: number;
    uninstalls: number;
  };
  /** Sum across apps per point in the series. */
  trend: {
    labels: string[];
    activeUsers: number[];
    sessions: number[];
    installs: number[];
    uninstalls: number[];
  };
  apps: AppAnalytics[];
}

/** Response for the Insights screen. */
export interface InsightsResponse {
  range: Range;
  dataSource: DataSource;
  lastSyncedAt: string | null;
  retention: { day1: number; day7: number; day14: number; day30: number };
  countries: { name: string; pct: number; users: number }[];
  uninstallsByApp: { appId: string; name: string; color: string; uninstalls: number; rate: number }[];
}

/**
 * Small bar-alias for drop-in use. React Native renderers only need the
 * metric objects below, but this line keeps the shape explicit.
 */
export type PortfolioResponse = { apps: ManagedApp[]; dataSource: DataSource; lastSyncedAt: string | null };