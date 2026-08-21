import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

type Range = '7D' | '30D' | '90D';

const apps = [
  { id: 'spark', name: 'Daily Spark', category: 'Lifestyle', color: '#FF755C', dau: 12450, growth: 8.4 },
  { id: 'nursing', name: 'Nursing MCQ', category: 'Education', color: '#6ED6B2', dau: 8240, growth: 12.1 },
  { id: 'quotes', name: 'Quotes App', category: 'Inspiration', color: '#A78BFA', dau: 5960, growth: -2.7 },
];

const trend = [42, 47, 44, 55, 58, 63, 69, 67, 74, 79, 76, 86];

function Metric({ label, value, change, icon, tone = colors.light.primary }: { label: string; value: string; change: string; icon: keyof typeof Feather.glyphMap; tone?: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: `${tone}22` }]}>
          <Feather name={icon} size={16} color={tone} />
        </View>
        <Text style={styles.metricChange}>{change}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function TrendChart({ range }: { range: Range }) {
  const bars = range === '7D' ? trend.slice(5) : range === '90D' ? [...trend, 91, 88, 94, 98] : trend;
  return (
    <View style={styles.chart}>
      <View style={styles.chartLabels}>
        <Text style={styles.chartBig}>DAU trend</Text>
        <Text style={styles.chartMeta}>12.4K today</Text>
      </View>
      <View style={styles.chartArea}>
        <View style={styles.gridLine} />
        <View style={[styles.gridLine, { top: '50%' }]} />
        <View style={[styles.gridLine, { top: '100%' }]} />
        <View style={styles.bars}>
          {bars.map((height, index) => (
            <View key={`${height}-${index}`} style={styles.barColumn}>
              <View style={[styles.bar, { height: `${height}%`, opacity: index === bars.length - 1 ? 1 : 0.55 + index / 30 }]} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>Aug 01</Text>
        <Text style={styles.axisText}>Aug 15</Text>
        <Text style={styles.axisText}>Aug 30</Text>
      </View>
    </View>
  );
}

export default function OverviewScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('30D');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApp, setSelectedApp] = useState('All apps');
  const activeApps = selectedApp === 'All apps' ? apps : apps.filter((app) => app.name === selectedApp);
  const totals = useMemo(() => ({
    dau: activeApps.reduce((sum, app) => sum + app.dau, 0),
    sessions: activeApps.reduce((sum, app) => sum + Math.round(app.dau * 2.3), 0),
  }), [activeApps]);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8, paddingBottom: Platform.OS === 'web' ? 34 : 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.light.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>SATURDAY, AUG 22</Text>
          <Text style={styles.title}>Good morning, Alex</Text>
        </View>
        <Pressable style={styles.avatar} testID="profile-button">
          <Text style={styles.avatarText}>A</Text>
        </Pressable>
      </View>

      <LinearGradient colors={['#172A43', '#112034']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE OVERVIEW</Text></View>
          <Text style={styles.heroTitle}>Your apps are trending up</Text>
          <Text style={styles.heroBody}>4 of 4 connected apps synced successfully.</Text>
        </View>
        <View style={styles.heroOrb}><Feather name="activity" size={26} color={colors.light.primary} /></View>
      </LinearGradient>

      <View style={styles.filterRow}>
        <Pressable style={styles.appPicker} onPress={() => setSelectedApp(selectedApp === 'All apps' ? apps[0].name : 'All apps')} testID="app-filter">
          <Feather name="layers" size={15} color={colors.light.primary} />
          <Text style={styles.appPickerText}>{selectedApp}</Text>
          <Feather name="chevron-down" size={15} color={colors.light.mutedForeground} />
        </Pressable>
        <View style={styles.rangePicker}>
          {(['7D', '30D', '90D'] as Range[]).map((item) => (
            <Pressable key={item} onPress={() => setRange(item)} style={[styles.rangeOption, range === item && styles.rangeActive]} testID={`range-${item}`}>
              <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <Metric label="Daily active users" value={`${(totals.dau / 1000).toFixed(1)}K`} change="+8.4%" icon="users" />
        <Metric label="Monthly active users" value="48.2K" change="+11.8%" icon="calendar" tone="#6ED6B2" />
        <Metric label="Sessions" value={`${(totals.sessions / 1000).toFixed(1)}K`} change="+5.2%" icon="repeat" tone="#A78BFA" />
        <Metric label="Retention · day 7" value="24.8%" change="+2.1%" icon="heart" tone="#F6B85C" />
      </View>

      <TrendChart range={range} />

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>App performance</Text><Text style={styles.sectionSubtitle}>Live snapshot across your portfolio</Text></View>
        <Pressable><Text style={styles.link}>See all</Text></Pressable>
      </View>
      <View style={styles.performanceCard}>
        {apps.map((app, index) => (
          <View key={app.id} style={[styles.appRow, index < apps.length - 1 && styles.rowDivider]}>
            <View style={[styles.appIcon, { backgroundColor: `${app.color}22` }]}><Feather name="zap" size={16} color={app.color} /></View>
            <View style={styles.appInfo}><Text style={styles.appName}>{app.name}</Text><Text style={styles.appCategory}>{app.category}</Text></View>
            <View style={styles.appNumbers}><Text style={styles.appDau}>{(app.dau / 1000).toFixed(1)}K <Text style={styles.smallUnit}>DAU</Text></Text><Text style={[styles.growth, app.growth < 0 && styles.negative]}>{app.growth > 0 ? '+' : ''}{app.growth}%</Text></View>
            <Feather name={app.growth < 0 ? 'trending-down' : 'trending-up'} size={17} color={app.growth < 0 ? colors.light.destructive : colors.light.primary} />
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Needs your attention</Text><Text style={styles.sectionSubtitle}>1 alert across connected apps</Text></View><Feather name="bell" size={18} color={colors.light.mutedForeground} /></View>
      <View style={styles.alertCard}>
        <View style={styles.alertIcon}><Feather name="alert-triangle" size={17} color="#F6B85C" /></View>
        <View style={styles.alertCopy}><Text style={styles.alertTitle}>Quotes App retention dipped</Text><Text style={styles.alertBody}>Day 7 retention is down 4.2% vs last period.</Text></View>
        <Feather name="chevron-right" size={18} color={colors.light.mutedForeground} />
      </View>
      <Text style={styles.footerNote}>Last synced 2 minutes ago · Demo workspace</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 18, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.light.foreground, fontSize: 25, fontWeight: '700', letterSpacing: -0.6, marginTop: 5 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF755C', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.light.primaryForeground, fontSize: 16, fontWeight: '700' },
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
  rangeText: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '700' },
  rangeTextActive: { color: colors.light.foreground },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48.5%', backgroundColor: colors.light.card, borderRadius: 17, padding: 14, borderWidth: 1, borderColor: colors.light.border, gap: 7 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricIcon: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricChange: { color: '#6ED6B2', fontSize: 10, fontWeight: '700' },
  metricValue: { color: colors.light.foreground, fontSize: 23, fontWeight: '700', letterSpacing: -0.7 },
  metricLabel: { color: colors.light.mutedForeground, fontSize: 11 },
  chart: { backgroundColor: colors.light.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.light.border },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartBig: { color: colors.light.foreground, fontSize: 15, fontWeight: '700' },
  chartMeta: { color: colors.light.primary, fontSize: 12, fontWeight: '600' },
  chartArea: { height: 122, position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', left: 0, right: 0, top: 0, borderTopWidth: 1, borderColor: colors.light.border },
  bars: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.light.primary, borderRadius: 5, minHeight: 5 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { color: colors.light.mutedForeground, fontSize: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  sectionTitle: { color: colors.light.foreground, fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 },
  link: { color: colors.light.primary, fontSize: 12, fontWeight: '700' },
  performanceCard: { backgroundColor: colors.light.card, borderRadius: 19, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.light.border },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.light.border },
  appIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  appInfo: { flex: 1 },
  appName: { color: colors.light.foreground, fontSize: 13, fontWeight: '600' },
  appCategory: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 3 },
  appNumbers: { alignItems: 'flex-end', gap: 3 },
  appDau: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  smallUnit: { color: colors.light.mutedForeground, fontSize: 9, fontWeight: '500' },
  growth: { color: '#6ED6B2', fontSize: 10, fontWeight: '700' },
  negative: { color: colors.light.destructive },
  alertCard: { backgroundColor: '#2A2418', borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#604A28' },
  alertIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#F6B85C22', alignItems: 'center', justifyContent: 'center' },
  alertCopy: { flex: 1, gap: 4 },
  alertTitle: { color: '#F4D49A', fontSize: 12, fontWeight: '700' },
  alertBody: { color: '#B69E70', fontSize: 10, lineHeight: 15 },
  footerNote: { color: colors.light.mutedForeground, fontSize: 10, textAlign: 'center', marginVertical: 4 },
});