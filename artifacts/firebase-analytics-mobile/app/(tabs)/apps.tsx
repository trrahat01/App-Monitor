import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { loadPortfolio, addTrackedApp } from '@/services/api';

type AppItem = { id: string; name: string; category: string; packageName: string; enabled: boolean; status: string; color: string };
const starterApps: AppItem[] = [
  { id: 'spark', name: 'Daily Spark', category: 'Lifestyle', packageName: 'com.dailyspark.app', enabled: true, status: 'Synced 2m ago', color: '#FF755C' },
  { id: 'nursing', name: 'Nursing MCQ', category: 'Education', packageName: 'com.nursingmcq.app', enabled: true, status: 'Synced 2m ago', color: '#6ED6B2' },
  { id: 'quotes', name: 'Quotes App', category: 'Inspiration', packageName: 'com.quotes.app', enabled: true, status: 'Synced 2m ago', color: '#A78BFA' },
];

export default function AppsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppItem[]>(starterApps);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [gaPropertyId, setGaPropertyId] = useState('');
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('analytics-apps').then((value) => { if (value) setItems(JSON.parse(value) as AppItem[]); });
    void loadPortfolio().then((pf) => {
      if (pf) {
        setConnected(pf.dataSource === 'live');
        const updated = pf.apps.map((app) => ({ id: app.id, name: app.name, category: app.category, packageName: app.packageName, enabled: true, status: app.status, color: app.color }));
        setItems(updated);
      }
    });
  }, []);
  const persist = (next: AppItem[]) => { setItems(next); AsyncStorage.setItem('analytics-apps', JSON.stringify(next)); };
  const toggle = (id: string) => persist(items.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  const [saving, setSaving] = useState(false);
  const addApp = async () => {
    if (!name.trim() || !packageName.trim() || !gaPropertyId.trim()) { Alert.alert('Add an app', 'Enter the app name, package name, and its GA4 property ID.'); return; }
    setSaving(true);
    try {
      const created = await addTrackedApp({ name: name.trim(), packageName: packageName.trim(), gaPropertyId: gaPropertyId.trim() });
      if (created) {
        persist([...items, { id: created.id, name: created.name, category: created.category ?? 'Apps', packageName: created.packageName, enabled: true, status: 'Added · awaiting sync', color: created.color }]);
        Alert.alert('Added', `${created.name} is now monitored.`);
      } else {
        Alert.alert('Not added', 'The backend could not register this app. Check your connection and that you have a valid GA4 property ID.');
      }
    } finally {
      setSaving(false);
      setName(''); setPackageName(''); setGaPropertyId(''); setShowAdd(false);
    }
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18) + 8, paddingBottom: Platform.OS === 'web' ? 34 : 28 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>PORTFOLIO</Text><Text style={styles.title}>Connected apps</Text></View><View style={styles.headerActions}><View style={[styles.sourcePill, connected ? styles.sourceLive : styles.sourceDemo]}><View style={[styles.sourceDot, { backgroundColor: connected ? '#6ED6B2' : '#8B9AB0' }]} /><Text style={styles.sourceText}>{connected ? 'CONNECTED' : 'OFFLINE'}</Text></View><Pressable style={styles.addButton} onPress={() => setShowAdd(true)} testID="add-app"><Feather name="plus" size={18} color={colors.light.primaryForeground} /></Pressable></View></View>
      <View style={styles.summary}><View><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>connected applications</Text></View><View style={styles.summaryDivider} /><View><Text style={styles.summaryValue}>{items.filter((item) => item.enabled).length}</Text><Text style={styles.summaryLabel}>active in overview</Text></View></View>
      {items.map((item) => (
        <View key={item.id} style={styles.appCard}>
          <View style={[styles.appIcon, { backgroundColor: `${item.color}22` }]}><Feather name="zap" size={18} color={item.color} /></View>
          <View style={styles.appInfo}><Text style={styles.appName}>{item.name}</Text><Text style={styles.package}>{item.packageName}</Text><View style={styles.statusRow}><View style={[styles.statusDot, { backgroundColor: item.status === 'Needs attention' ? '#F6B85C' : item.status === 'Not connected' ? colors.light.mutedForeground : '#6ED6B2' }]} /><Text style={styles.status}>{item.status}</Text></View></View>
          <Pressable onPress={() => toggle(item.id)} style={[styles.switch, item.enabled && styles.switchOn]} testID={`toggle-${item.id}`}><View style={[styles.knob, item.enabled && styles.knobOn]} /></Pressable>
        </View>
      ))}
      <View style={styles.connectionCard}><View style={styles.connectionIcon}><Feather name="shield" size={19} color={colors.light.primary} /></View><View style={styles.connectionCopy}><Text style={styles.connectionTitle}>{connected ? 'Firebase + Play reporting' : 'Connect Firebase + Play'}</Text><Text style={styles.connectionBody}>{connected ? 'Live sync is active. Installs, opens and uninstalls are streaming from Play + Firebase through your Render backend.' : 'Add your Google service account on the backend to sync real installs, opens and uninstalls.'}</Text></View><Feather name="chevron-right" size={18} color={colors.light.mutedForeground} /></View>
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}><View style={styles.modalBackdrop}><View style={styles.modal}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Add an application</Text><Text style={styles.modalSubtitle}>Enter the app plus its GA4 property ID to stream live data.</Text><TextInput value={name} onChangeText={setName} placeholder="App name" placeholderTextColor={colors.light.mutedForeground} style={styles.input} /><TextInput value={packageName} onChangeText={setPackageName} placeholder="Android package name" placeholderTextColor={colors.light.mutedForeground} autoCapitalize="none" style={styles.input} /><TextInput value={gaPropertyId} onChangeText={setGaPropertyId} placeholder="GA4 property ID (numbers only)" placeholderTextColor={colors.light.mutedForeground} keyboardType="number-pad" autoCapitalize="none" style={styles.input} /><Text style={styles.modalHint}>Find the property ID in Google Analytics 4 → Admin → Property settings.</Text><Pressable style={styles.saveButton} onPress={addApp} disabled={saving} testID="save-app"><Text style={styles.saveText}>{saving ? 'Adding…' : 'Save application'}</Text></Pressable><Pressable style={styles.cancelButton} onPress={() => setShowAdd(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable></View></View></Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background }, content: { paddingHorizontal: 18, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sourcePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10 }, sourceLive: { backgroundColor: '#173B2A' }, sourceDemo: { backgroundColor: '#3A2E18' }, sourceDot: { width: 6, height: 6, borderRadius: 3 }, sourceText: { color: colors.light.foreground, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }, eyebrow: { color: colors.light.mutedForeground, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 }, title: { color: colors.light.foreground, fontSize: 25, fontWeight: '700', marginTop: 5 }, addButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.light.primary, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.card, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: colors.light.border, marginBottom: 4 }, summaryValue: { color: colors.light.foreground, fontSize: 22, fontWeight: '700' }, summaryLabel: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 3 }, summaryDivider: { height: 35, width: 1, backgroundColor: colors.light.border, marginHorizontal: 28 },
  appCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.light.border, gap: 11 }, appIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, appInfo: { flex: 1 }, appName: { color: colors.light.foreground, fontSize: 14, fontWeight: '700' }, package: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 4 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, status: { color: colors.light.mutedForeground, fontSize: 10 },
  switch: { width: 39, height: 23, borderRadius: 13, backgroundColor: colors.light.secondary, padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: '#FF755C55' }, knob: { width: 17, height: 17, borderRadius: 9, backgroundColor: colors.light.mutedForeground }, knobOn: { alignSelf: 'flex-end', backgroundColor: colors.light.primary },
  connectionCard: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#172A43', borderRadius: 18, padding: 15 }, connectionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FF755C22', alignItems: 'center', justifyContent: 'center' }, connectionCopy: { flex: 1 }, connectionTitle: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' }, connectionBody: { color: '#9FB1C8', fontSize: 10, lineHeight: 15, marginTop: 4 }, connectionTag: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' }, modal: { backgroundColor: colors.light.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 12 }, modalHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: colors.light.border, marginBottom: 8 }, modalTitle: { color: colors.light.foreground, fontSize: 22, fontWeight: '700' }, modalSubtitle: { color: colors.light.mutedForeground, fontSize: 12, marginBottom: 6 }, modalHint: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16 }, input: { color: colors.light.foreground, backgroundColor: colors.light.card, borderColor: colors.light.border, borderWidth: 1, borderRadius: 13, padding: 14, fontSize: 13 }, saveButton: { alignItems: 'center', backgroundColor: colors.light.primary, borderRadius: 13, padding: 15, marginTop: 5 }, saveText: { color: colors.light.primaryForeground, fontSize: 13, fontWeight: '700' }, cancelButton: { alignItems: 'center', padding: 8 }, cancelText: { color: colors.light.mutedForeground, fontSize: 13, fontWeight: '600' },
});