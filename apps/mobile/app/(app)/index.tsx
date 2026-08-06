import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchDashboard, DashboardStats } from '@/api/clientPanel';
import { useAuthStore } from '@/stores/authStore';
import { t } from '@/i18n';

/**
 * Dashboard (client-panel-specs, task 5.5): consumes GET /client/dashboard and
 * renders the four stats (totalPackages, inTransit, readyForPickup, delivered)
 * plus the last five packages. The tenant header is injected by the axios
 * interceptor; a 401 transparently refreshes the session (single-flight lock).
 */
export default function DashboardScreen() {
  const router = useRouter();
  const client = useAuthStore((s) => s.client);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setStats(await fetchDashboard());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onLogout = async () => {
    await clearAuth();
    // status flips to unauthenticated → (app) guard redirects to /login.
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const statCards = [
    { key: 'totalPackages', label: t('dashboard.stats.totalPackages'), value: stats.totalPackages },
    { key: 'inTransit', label: t('dashboard.stats.inTransit'), value: stats.inTransit },
    { key: 'readyForPickup', label: t('dashboard.stats.readyForPickup'), value: stats.readyForPickup },
    { key: 'delivered', label: t('dashboard.stats.delivered'), value: stats.delivered },
  ];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={stats.lastTracking}
      keyExtractor={(item) => item.tracking}
      ListHeaderComponent={
        <>
          <Text style={styles.welcome}>{t('dashboard.welcome', { name: client?.name ?? '' })}</Text>
          <View style={styles.grid}>
            {statCards.map((card) => (
              <View key={card.key} style={styles.card}>
                <Text style={styles.cardValue}>{card.value}</Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t('dashboard.recent')}</Text>
            <Pressable onPress={() => router.push('/packages')}>
              <Text style={styles.viewAll}>{t('dashboard.viewAll')}</Text>
            </Pressable>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/packages/${item.tracking}`)}>
          <Text style={styles.rowTracking}>{item.tracking}</Text>
          <Text style={styles.rowStatus}>{t(`status.${item.status}`)}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t('packages.empty')}</Text>}
      ListFooterComponent={
        <Pressable style={styles.logout} onPress={onLogout}>
          <Text style={styles.logoutText}>{t('dashboard.logout')}</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 16 },
  retry: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  welcome: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: {
    width: '47%',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  cardValue: { fontSize: 28, fontWeight: '800', color: '#2563eb' },
  cardLabel: { fontSize: 13, color: '#475569', marginTop: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  viewAll: { color: '#2563eb', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowTracking: { fontWeight: '600' },
  rowStatus: { color: '#64748b' },
  empty: { color: '#64748b', paddingVertical: 16 },
  logout: {
    marginTop: 24,
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600' },
});
