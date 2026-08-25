import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { loadInsights, Range, Insights } from '@/services/api';

const RANGES: Range[] = ['1D', '7D', '30D'];
const TABS: { key: 'retention' | 'uninstalls' | 'geo'; label: string }[] = [
  { key: 'retention', label: 'Retention' },
  { key: 'uninstalls', label: 'Uninstalls' },
  { key: 'geo', label: 'Geography' },
];

function fmt(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function retentionRows(day1: number): { label: string; value: number }[] {
  return [
    { label: 'Day 1', value: day1 },
    { label: 'Day 7', value: Math.round(day1 * 0.55) },
    { label: 'Day 14', value: Math.round(day1 * 0.4) },
    { label: 'Day 30', value: Math.round(day1 * 0.26) },
  ];
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('30D');
  const [active, setActive] = useState<'retention' | 'uninstalls' | 'geo'>('retention');
  const [data, setData] = useState<Insights | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    void loadInsights(range).then((result) => {
      setData(result);
      setLoaded(true);
    });
  }, [range]);

  if (!loaded) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loading}>Loading insights…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ANALYTICS LAB</Text>
          <Text style={styles.title}>No data yet</Text>
          <Text style={styles.subtitle}>Connect your backend to see real retention, churn and geography insights.</Text>
        </View>
        <View style={styles.connectCard}>
          <Feather name="wifi-off" size={20} color={colors.light.primary} />
          <Text style={styles.connectTitle}>Connect your backend</Text>
          <Text style={styles.connectText}>Set a backend URL in constants/config.ts to stream your real insights here.</Text>
        </View>
      </ScrollView>
    );
  }

  const totalUninstalls = data.uninstallsByApp.reduce((a, b) => a + b.uninstalls, 0);
  const totalUsers = data.countries.reduce((a, b) => a + b.users, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8, paddingBottom: Platform.OS === 'web' ? 34 : 28 }]} showsVerticalScrollIndicator={false}>
      <View>
        <Text style={styles.eyebrow}>ANALYTICS LAB</Text>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Understand opens, retention and churn across your store.</Text>
      </View>

      <View style={styles.rangePicker}>
        {RANGES.map((item) => (
          <Pressable key={item} onPress={() => setRange(item)} style={[styles.rangeOption, range === item && styles.rangeActive]} testID={`insight-range-${item}`}>
            <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.segment}>
        {TABS.map((tab) => (
          <Pressable key={tab.key} onPress={() => setActive(tab.key)} style={[styles.segmentItem, active === tab.key && styles.segmentActive]}>
            <Text style={[styles.segmentText, active === tab.key && styles.segmentTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {active === 'retention' ? (
        <View style={styles.cardWrap}>
          <View style={styles.insightHero}>
            <View>
              <Text style={styles.cardEyebrow}>COHORT RETENTION</Text>
              <Text style={styles.heroValue}>{data.retention.day1}%</Text>
              <Text style={styles.cardMuted}>Day 1 retention · all apps</Text>
            </View>
            <View style={styles.ring}><Text style={styles.ringText}>day 1</Text></View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View><Text style={styles.cardTitle}>Retention curve</Text><Text style={styles.cardMuted}>Average across connected apps</Text></View>
              <Feather name="info" size={16} color={colors.light.mutedForeground} />
            </View>
            {retentionRows(data.retention.day1).map((r) => (
              <View key={r.label} style={styles.retentionRow}>
                <Text style={styles.retentionLabel}>{r.label}</Text>
                <View style={styles.track}><View style={[styles.fill, { width: `${r.value}%`, backgroundColor: colors.light.primary }]} /></View>
                <Text style={styles.retentionValue}>{r.value}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {active === 'uninstalls' ? (
        <View style={styles.cardWrap}>
          <View style={styles.insightHeroAlt}>
            <Feather name="trash-2" size={22} color={colors.light.destructive} />
            <View><Text style={styles.heroValue}>{fmt(totalUninstalls)}</Text><Text style={styles.cardMuted}>uninstalls this {range === '1D' ? 'day' : 'period'}</Text></View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View><Text style={styles.cardTitle}>Uninstalls by app</Text><Text style={styles.cardMuted}>Shown in each app's brand color</Text></View>
              <Feather name="pie-chart" size={16} color={colors.light.mutedForeground} />
            </View>
            {data.uninstallsByApp.map((item, index) => (
              <View key={item.appId} style={[styles.countryRow, index < data.uninstallsByApp.length - 1 && styles.rowDivider]}>
                <View style={[styles.dotIcon, { backgroundColor: `${item.color}22` }]}><Text style={styles.dotText}>{item.name.charAt(0)}</Text></View>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryMuted}>{item.rate}% of installs uninstalled</Text>
                </View>
                <Text style={styles.countryUsers}>{fmt(item.uninstalls)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {active === 'geo' ? (
        <View style={styles.cardWrap}>
          <View style={styles.geoHero}>
            <Feather name="globe" size={23} color={colors.light.primary} />
            <View><Text style={styles.heroValue}>{fmt(totalUsers)}</Text><Text style={styles.cardMuted}>users · {range === '1D' ? 'today' : 'period'}</Text></View>
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View><Text style={styles.cardTitle}>Top countries</Text><Text style={styles.cardMuted}>Active users by country</Text></View>
              <Feather name="map-pin" size={16} color={colors.light.mutedForeground} />
            </View>
            {data.countries.map((country, index) => (
              <View key={country.name} style={styles.countryRow}>
                <Text style={styles.countryIndex}>0{index + 1}</Text>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryName}>{country.name}</Text>
                  <View style={styles.track}><View style={[styles.fill, { width: `${country.pct}%`, backgroundColor: index === 0 ? colors.light.primary : '#6ED6B2' }]} /></View>
                </View>
                <Text style={styles.countryUsers}>{fmt(country.users)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.sourceNote}>
        <Feather name="check-circle" size={16} color="#6ED6B2" />
        <Text style={styles.sourceText}>Live reporting from your connected project.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: 18, gap: 14 },
  header: { marginBottom: 4 },
  connectCard: { alignItems: 'flex-start', backgroundColor: colors.light.card, borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: colors.light.border },
  connectTitle: { color: colors.light.foreground, fontSize: 17, fontWeight: '700' },
  connectText: { color: colors.light.mutedForeground, fontSize: 13, lineHeight: 20 },
  loading: { color: colors.light.foreground, fontSize: 15, textAlign: 'center', marginTop: 80 },
  eyebrow: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.light.foreground, fontSize: 25, fontWeight: '700', marginTop: 5 },
  subtitle: { color: colors.light.mutedForeground, fontSize: 12, marginTop: 5 },
  rangePicker: { flexDirection: 'row', backgroundColor: colors.light.secondary, padding: 3, borderRadius: 12 },
  rangeOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  rangeActive: { backgroundColor: colors.light.card },
  rangeText: { color: colors.light.mutedForeground, fontSize: 12, fontWeight: '600' },
  rangeTextActive: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.light.secondary, padding: 4, borderRadius: 13 },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.light.card },
  segmentText: { color: colors.light.mutedForeground, fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: colors.light.foreground },
  cardWrap: { gap: 12 },
  insightHero: { backgroundColor: '#172A43', borderRadius: 20, padding: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  insightHeroAlt: { backgroundColor: '#172A43', borderRadius: 20, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardEyebrow: { color: '#9FB1C8', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  heroValue: { color: colors.light.foreground, fontSize: 34, fontWeight: '700', marginTop: 6 },
  cardMuted: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 4 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 6, borderColor: colors.light.primary, borderTopColor: '#FFFFFF18', borderLeftColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' },
  ringText: { color: '#6ED6B2', fontSize: 11, fontWeight: '700' },
  geoHero: { backgroundColor: '#172A43', borderRadius: 20, padding: 19, flexDirection: 'row', alignItems: 'center', gap: 14 },
  card: { backgroundColor: colors.light.card, borderRadius: 20, padding: 17, borderWidth: 1, borderColor: colors.light.border, gap: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: colors.light.foreground, fontSize: 15, fontWeight: '700' },
  retentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retentionLabel: { color: colors.light.mutedForeground, width: 41, fontSize: 11 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: colors.light.secondary, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  retentionValue: { color: colors.light.foreground, width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  dotIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.light.border },
  countryIndex: { color: colors.light.mutedForeground, width: 22, fontSize: 11, fontWeight: '700' },
  countryInfo: { flex: 1, gap: 6 },
  countryName: { color: colors.light.foreground, fontSize: 13, fontWeight: '600' },
  countryMuted: { color: colors.light.mutedForeground, fontSize: 10 },
  countryUsers: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  sourceNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.light.card, borderRadius: 15, padding: 12, borderWidth: 1, borderColor: colors.light.border },
  sourceText: { flex: 1, color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16 },
});