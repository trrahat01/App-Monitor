import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { loadOverview } from '@/services/api';
import { recordTesters } from '@/services/api';
import { Range, Overview, AppMetric } from '@/services/api';

const RANGES: Range[] = ['1D', '7D', '30D'];

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function changeColor(n: number): string {
  return n < 0 ? colors.light.destructive : '#6ED6B2';
}

interface MetricProps {
  label: string;
  value: string;
  change: number;
  icon: keyof typeof Feather.glyphMap;
  tone?: string;
}

function Metric({ label, value, change, icon, tone = '#FF755C' }: MetricProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: `${tone}22` }]}>
          <Feather name={icon} size={16} color={tone} />
        </View>
        <Text style={[styles.metricChange, { color: changeColor(change) }]}>{displaySigned(change)}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function displaySigned(n: number): string {
  return displaySignedInner(n);
}
function displaySignedInner(n: number): string {
  if (Math.abs(n) < 0.05) return '0%';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** Formats an ISO date (YYYY-MM-DD) as a short MM/DD label. */
function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[1]}/${parts[2]}`;
}

/** Formats ISO date as a longer label (e.g. "Aug 25"). */
function fmtDateLong(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ChartProps {
  labels: string[];
  series: number[];
  color: string;
  title: string;
  meta: string;
}

function TrendChart({ labels, series, color, title, meta }: ChartProps) {
  const max = Math.max(...series, 1);
  return (
    <View style={styles.chart}>
      <View style={styles.chartLabels}>
        <Text style={styles.chartBig}>{title}</Text>
        <Text style={[styles.chartMeta, { color }]}>{meta}</Text>
      </View>
      <View style={styles.chartArea}>
        <View style={styles.gridLine} />
        <View style={[styles.gridLine, { top: '50%' }]} />
        <View style={[styles.gridLine, { top: '100%' }]} />
        <View style={styles.bars}>
          {series.map((value, index) => (
            <View key={`${value}-${index}`} style={styles.barColumn}>
              <View style={[styles.bar, { backgroundColor: color, height: `${Math.max(3, (value / max) * 100)}%` }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{fmtDateLong(labels[0])}</Text>
        <Text style={styles.axisText}>{fmtDateLong(labels[Math.floor((labels.length - 1) / 2)])}</Text>
        <Text style={styles.axisText}>{fmtDateLong(labels[labels.length - 1])}</Text>
      </View>
    </View>
  );
}

export default function OverviewScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('30D');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedApp, setSelectedApp] = useState('All apps');
  const [loaded, setLoaded] = useState(false);
  const [testerInput, setTesterInput] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const saveTesters = async (app: AppMetric) => {
    const raw = testerInput[app.appId];
    if (raw === undefined || raw.trim() === '') return;
    const count = Number(raw);
    if (!Number.isFinite(count) || count < 0) { Alert.alert('Invalid number', 'Enter a valid tester count.'); return; }
    setUpdating(app.appId);
    try {
      const ok = await recordTesters(app.appId, Math.round(count));
      if (ok) {
        Alert.alert('Saved', `${app.name}: record today's testers as ${Math.round(count)}.`);
        setTesterInput((m) => ({ ...m, [app.appId]: '' }));
        await loadOverview(range).then(setOverview);
      } else {
        Alert.alert('Not saved', 'Could not reach the backend. Record the count later.');
      }
    } finally {
      setUpdating(null);
    }
  };

  useEffect(() => {
    setLoaded(false);
    void loadOverview(range).then((data) => {
      setOverview(data);
      setLoaded(true);
      if (selectedApp !== 'All apps' && data && !data.apps.some((a) => a.name === selectedApp)) {
        setSelectedApp('All apps');
      }
    });
  }, [range]);

  const refresh = () => {
    setLoaded(false);
    void loadOverview(range).then((data) => {
      setOverview(data);
      setLoaded(true);
    });
  };

  if (!loaded) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View><Text style={styles.eyebrow}>ANALYTICS</Text><Text style={styles.title}>Loading…</Text></View>
        </View>
        <View style={styles.loadingCard}><Feather name="clock" size={18} color={colors.light.primary} /><Text style={styles.loadingText}>Pulling your store analytics…</Text></View>
      </ScrollView>
    );
  }

  if (!overview) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View><Text style={styles.eyebrow}>ANALYTICS</Text><Text style={styles.title}>No data yet</Text></View>
        </View>
        <View style={styles.connectCard}>
          <Feather name="wifi-off" size={20} color={colors.light.primary} />
          <Text style={styles.connectTitle}>Connect your backend</Text>
          <Text style={styles.connectText}>
            Set a backend URL in constants/config.ts (or the EXPO_PUBLIC_API_URL env var) to stream your real store metrics here.
            Until then there is no data to show.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const activeApps = selectedApp === 'All apps' ? overview.apps : overview.apps.filter((a) => a.name === selectedApp);
  const single = selectedApp !== 'All apps' ? activeApps[0] : undefined;
  const trendSeries = single ? single.trend.activeUsers : overview.trend.activeUsers;
  const chartColor = single ? single.color : colors.light.primary;
  const totals = single ? single.totals : overview.totals;
  const changes = single ? single.changes : overview.changes;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8, paddingBottom: Platform.OS === 'web' ? 34 : 28 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>PORTFOLIO ANALYTICS</Text><Text style={styles.title}>App store dashboard</Text></View>
        <Pressable onPress={refresh} style={styles.avatar} testID="profile-button"><Feather name="refresh-cw" size={17} color={colors.light.primaryForeground} /></Pressable>
      </View>

      <LinearGradient colors={['#172A43', '#112034']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE DATA</Text>
          </View>
          <Text style={styles.heroTitle}>Closed-testing monitor</Text>
          <Text style={styles.heroBody}>Real testers, crashes, ANRs and opens from your Play closed-testing apps.</Text>
        </View>
        <View style={styles.heroOrb}><Feather name="activity" size={26} color={colors.light.primary} /></View>
      </LinearGradient>

      <View style={styles.filterRow}>
        <Pressable style={styles.appPicker} onPress={() => setSelectedApp(selectedApp === 'All apps' ? overview.apps[0]?.name ?? 'All apps' : 'All apps')} testID="app-filter">
          <Feather name="layers" size={15} color={colors.light.primary} />
          <Text style={styles.appPickerText}>{selectedApp}</Text>
          <Feather name="chevron-down" size={15} color={colors.light.mutedForeground} />
        </Pressable>
        <View style={styles.rangePicker}>
          {RANGES.map((item) => (
            <Pressable key={item} onPress={() => setRange(item)} style={[styles.rangeOption, range === item && styles.rangeActive]} testID={`range-${item}`}>
              <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
        <Metric label="Testers" value={fmt(totals.testers)} change={0} icon="users" tone="#FF755C" />
        <Metric label="Active users" value={fmt(totals.activeUsers)} change={changes.activeUsers} icon="activity" tone="#4FC3F7" />
        <Metric label="Crashes" value={fmt(totals.crashes)} change={0} icon="alert-triangle" tone="#F6B85C" />
        <Metric label="ANRs" value={fmt(totals.anrs)} change={0} icon="alert-circle" tone="#F48FB1" />
        <Metric label="Crash-free" value={`${totals.crashFreeRate}%`} change={0} icon="shield" tone="#6ED6B2" />
        <Metric label="Sessions" value={fmt(totals.sessions)} change={changes.sessions} icon="repeat" tone="#A78BFA" />
        <Metric label="Installs" value={fmt(totals.installs)} change={changes.installs} icon="download" tone="#81C784" />
        <Metric label="Uninstalls" value={fmt(totals.uninstalls)} change={changes.uninstalls} icon="trash-2" tone="#F56B6B" />
      </ScrollView>

      <TrendChart labels={overview.trend.labels} series={trendSeries} color={chartColor} title="Active users trend" meta={`${fmt(totals.activeUsers)} now`} />

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>Closed-testing apps</Text><Text style={styles.sectionSubtitle}>{range} metrics · tap a row to filter</Text></View>
        <Feather name="bar-chart-2" size={18} color={colors.light.mutedForeground} />
      </View>
      <View style={styles.performanceCard}>
        {overview.apps.map((app, index) => (
          <Pressable key={app.appId} onPress={() => setSelectedApp(app.name)} style={[styles.appRow, index < overview.apps.length - 1 && styles.rowDivider]} testID={`app-row-${app.appId}`}>
            <View style={[styles.appIcon, { backgroundColor: `${app.color}22` }]}><Feather name="zap" size={16} color={app.color} /></View>
            <View style={styles.appInfo}><Text style={styles.appName}>{app.name}</Text><Text style={styles.appCategory}>{fmt(app.totals.testers)} testers · {fmt(app.totals.crashes)} crashes · {fmt(app.totals.anrs)} ANRs</Text></View>
            <View style={styles.appNumbers}>
              <Text style={styles.appDau}>{fmt(app.totals.activeUsers)} <Text style={styles.smallUnit}>users</Text></Text>
              <Text style={styles.appInstalls}>{fmt(app.totals.installs)} <Text style={styles.smallUnit}>installs</Text></Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.light.mutedForeground} />
          </Pressable>
        ))}
      </View>

<View style={styles.complianceCard}>
        <View style={styles.complianceHeader}>
          <View><Text style={styles.complianceTitle}>Play closed-testing goal</Text><Text style={styles.complianceSub}>≥12 testers for ≥14 continuous days</Text></View>
          <View style={[styles.compliancePill, (single ? single.closedTesting.compliant : overview.apps.some((a) => a.closedTesting.compliant)) ? styles.complianceDone : styles.compliancePending]}>
            <Feather name={(single ? single.closedTesting.compliant : overview.apps.some((a) => a.closedTesting.compliant)) ? 'check-circle' : 'clock'} size={12} color="#0B1220" />
            <Text style={styles.compliancePillText}>{(single ? single.closedTesting.compliant : overview.apps.some((a) => a.closedTesting.compliant)) ? 'MET' : 'IN PROGRESS'}</Text>
          </View>
        </View>
        {overview.apps.map((app) => (
          <View key={app.appId} style={styles.complianceRow}>
            <View style={[styles.complianceDot, { backgroundColor: app.color }]} />
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceAppName}>{app.name}</Text>
              <View style={styles.complianceBarTrack}>
                <View style={[styles.complianceBarFill, { width: `${Math.min(100, (app.closedTesting.daysAt12Plus / app.closedTesting.requiredDays) * 100)}%`, backgroundColor: app.color }]} />
              </View>
              <View style={styles.dayStrip}>
                {(app.closedTesting.history ?? []).map((h) => (
                  <View key={h.date} style={styles.dayCellWrap}>
                    <View
                      style={[
                        styles.dayCell,
                        h.testers === null ? styles.dayMissing : (h.met ? styles.dayMet : styles.dayNot),
                      ]}
                    >
                      {h.testers !== null ? <Text style={styles.dayCellCount}>{h.testers}</Text> : null}
                    </View>
                    <Text style={styles.dayCellDate}>{fmtDate(h.date)}</Text>
                  </View>
                ))}
              </View>
              {app.closedTesting.resetToday ? <Text style={styles.complianceReset}>Streak reset · under 12 testers recently</Text> : null}
            </View>
            <View style={styles.testerInputGroup}>
              <TextInput
                value={testerInput[app.appId] ?? ''}
                onChangeText={(t) => setTesterInput((m) => ({ ...m, [app.appId]: t }))}
                placeholder="today"
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="number-pad"
                style={styles.testerInput}
              />
              <Pressable onPress={() => saveTesters(app)} disabled={updating === app.appId} style={styles.testerSave} testID={`save-testers-${app.appId}`}>
                <Feather name={updating === app.appId ? 'loader' : 'plus'} size={14} color={colors.light.primaryForeground} />
              </Pressable>
            </View>
            <Text style={styles.complianceDays}>{app.closedTesting.daysAt12Plus}/{app.closedTesting.requiredDays}d</Text>
            <Feather name={app.closedTesting.compliant ? 'check-circle' : 'info'} size={15} color={app.closedTesting.compliant ? '#6ED6B2' : '#F6B85C'} />
          </View>
        ))}
      </View>
      <View style={styles.sourceNote}>
<Feather name="check-circle" size={16} color="#6ED6B2" />
        <Text style={styles.sourceText}>Live data · synced {overview.lastSyncedAt ?? 'recently'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 18, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.light.foreground, fontSize: 25, fontWeight: '700', letterSpacing: -0.6, marginTop: 5 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.light.primary, alignItems: 'center', justifyContent: 'center' },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.light.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.light.border },
  loadingText: { color: colors.light.mutedForeground, fontSize: 12 },
  connectCard: { alignItems: 'flex-start', backgroundColor: colors.light.card, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: colors.light.border },
  connectTitle: { color: colors.light.foreground, fontSize: 17, fontWeight: '700' },
  connectText: { color: colors.light.mutedForeground, fontSize: 13, lineHeight: 20 },
  hero: { borderRadius: 22, padding: 19, minHeight: 122, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  heroCopy: { flex: 1, gap: 7 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6ED6B2' },
  liveText: { color: '#9FB1C8', fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  heroTitle: { color: '#F4F7FB', fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  heroBody: { color: '#9FB1C8', fontSize: 12 },
  heroOrb: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF755C1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF755C4D' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appPicker: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.light.secondary },
  appPickerText: { color: colors.light.foreground, fontSize: 12, fontWeight: '600' },
  rangePicker: { flexDirection: 'row', backgroundColor: colors.light.secondary, padding: 3, borderRadius: 10 },
  rangeOption: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  rangeActive: { backgroundColor: colors.light.card },
  rangeText: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700' },
  rangeTextActive: { color: colors.light.foreground, fontSize: 11, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  metricCard: { width: 146, backgroundColor: colors.light.card, borderRadius: 17, padding: 14, borderWidth: 1, borderColor: colors.light.border, gap: 7 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricIcon: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricChange: { fontSize: 10, fontWeight: '700' },
  metricValue: { color: colors.light.foreground, fontSize: 23, fontWeight: '700', letterSpacing: -0.7 },
  metricLabel: { color: colors.light.mutedForeground, fontSize: 11 },
  chart: { backgroundColor: colors.light.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.light.border },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartBig: { color: colors.light.foreground, fontSize: 15, fontWeight: '700' },
  chartMeta: { fontSize: 12, fontWeight: '600' },
  chartArea: { height: 122, position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, top: 0, borderTopWidth: 1, borderColor: colors.light.border },
  bars: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5 },
  bar: { borderRadius: 5, minHeight: 3 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { color: colors.light.mutedForeground, fontSize: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionTitle: { color: colors.light.foreground, fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 },
  performanceCard: { backgroundColor: colors.light.card, borderRadius: 19, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.light.border },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.light.border },
  appIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  appInfo: { flex: 1 },
  appName: { color: colors.light.foreground, fontSize: 13, fontWeight: '600' },
  appCategory: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 3 },
  appNumbers: { alignItems: 'flex-end', gap: 3 },
  appDau: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  appInstalls: { color: '#6ED6B2', fontSize: 10, fontWeight: '700' },
  smallUnit: { color: colors.light.mutedForeground, fontSize: 9, fontWeight: '500' },
  sourceNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.light.card, borderRadius: 15, padding: 12, borderWidth: 1, borderColor: colors.light.border },
  sourceText: { flex: 1, color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16 },
  complianceCard: { backgroundColor: colors.light.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.light.border, gap: 12 },
  complianceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  complianceTitle: { color: colors.light.foreground, fontSize: 15, fontWeight: '700' },
  complianceSub: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 2 },
  compliancePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  complianceDone: { backgroundColor: '#6ED6B2' },
  compliancePending: { backgroundColor: '#F6B85C' },
  compliancePillText: { color: '#0B1220', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  complianceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  complianceDot: { width: 9, height: 9, borderRadius: 5 },
  complianceInfo: { flex: 1, gap: 5 },
  complianceAppName: { color: colors.light.foreground, fontSize: 12, fontWeight: '600' },
  complianceBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.light.secondary, overflow: 'hidden' },
  complianceBarFill: { height: 6, borderRadius: 3 },
  complianceDays: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700', width: 44, textAlign: 'right' },
  complianceReset: { color: '#F6B85C', fontSize: 10, marginTop: 2 },
  dayStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 3, marginTop: 4, flexWrap: 'wrap' },
  dayCellWrap: { alignItems: 'center', gap: 2 },
  dayCell: { width: 16, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  dayCellCount: { color: '#0B1220', fontSize: 8, fontWeight: '800' },
  dayCellDate: { color: colors.light.mutedForeground, fontSize: 7 },
  dayMet: { backgroundColor: '#6ED6B2' },
  dayNot: { backgroundColor: '#F56B6B' },
  dayMissing: { backgroundColor: colors.light.border },
  dayLegend: { color: colors.light.mutedForeground, fontSize: 9, marginLeft: 4 },
  testerInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  testerInput: { color: colors.light.foreground, backgroundColor: colors.light.secondary, borderColor: colors.light.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, minWidth: 46, textAlign: 'center' },
  testerSave: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.light.primary, alignItems: 'center', justifyContent: 'center' },
});