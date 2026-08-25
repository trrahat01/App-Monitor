/**
 * Typed client for the analytics backend.
 *
 * Data is always REAL â€” pulled from your backend. When no backend URL is
 * configured (or it can't be reached) the loaders resolve to `null` so screens
 * can show a "connect your backend" empty state instead of fake numbers.
 */

import { BACKEND_URL } from '@/constants/config';

export type Range = '1D' | '7D' | '30D';
export type DataSource = 'live' | 'offline' | 'demo';

export interface ManagedApp {
  id: string;
  name: string;
  category: string;
  packageName: string;
  color: string;
  enabled: boolean;
  status: string;
  /** Optional Firebase analytics project id used to key live data per app. */
  firebaseProjectId?: string;
}

export interface MetricTotals {
  activeUsers: number;
  sessions: number;
  installs: number;
  uninstalls: number;
}

export interface MetricChanges {
  activeUsers: number;
  sessions: number;
  installs: number;
  uninstalls: number;
}

export interface TrendSeries {
  labels: string[];
  activeUsers: number[];
  sessions: number[];
  installs: number[];
  uninstalls: number[];
}

export interface AppMetric {
  appId: string;
  name: string;
  category: string;
  color: string;
  dataSource: DataSource;
  liveAt: string | null;
  totals: MetricTotals;
  changes: MetricChanges;
  retentionDay1: number;
  retentionDay7: number;
  rating: number;
  trend: TrendSeries;
}

export interface Overview {
  range: Range;
  dataSource: DataSource;
  lastSyncedAt: string | null;
  totals: MetricTotals;
  changes: MetricChanges;
  trend: TrendSeries;
  apps: AppMetric[];
}

export interface Insights {
  range: Range;
  dataSource: DataSource;
  lastSyncedAt: string | null;
  retention: { day1: number; day7: number; day14: number; day30: number };
  countries: { name: string; pct: number; users: number }[];
  uninstallsByApp: { appId: string; name: string; color: string; uninstalls: number; rate: number }[];
}

export interface PortfolioResult {
  apps: ManagedApp[];
  dataSource: DataSource;
  lastSyncedAt: string | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Fetch overview for a range. Resolves to `null` when no real data is available. */
export async function loadOverview(range: Range): Promise<Overview | null> {
  if (!BACKEND_URL) return null;
  try {
    return await getJson<Overview>(`/overview?range=${range}`);
  } catch {
    return null;
  }
}

export async function loadInsights(range: Range): Promise<Insights | null> {
  if (!BACKEND_URL) return null;
  try {
    return await getJson<Insights>(`/insights?range=${range}`);
  } catch {
    return null;
  }
}

export async function loadPortfolio(): Promise<PortfolioResult | null> {
  if (!BACKEND_URL) return null;
  try {
    return await getJson<PortfolioResult>('/apps');
  } catch {
    return null;
  }
}
