import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchDashboard, DashboardStats } from '@/api/clientPanel';
import { useAuthStore } from '@/stores/authStore';
import { t } from '@/i18n';

export default function DashboardScreen() {
  const router = useRouter();
  const client = useAuthStore((s) => s.client);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
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
    { key: 'inTransit', label: t('dashboard.stats.inTransit'), value: stats.inTransit, icon: '🚚' },
    { key: 'readyForPickup', label: t('dashboard.stats.readyForPickup'), value: stats.readyForPickup, icon: '📦' },
    { key: 'delivered', label: t('dashboard.stats.delivered'), value: stats.delivered, icon: '✅' },
    { key: 'totalPackages', label: t('dashboard.stats.totalPackages'), value: stats.totalPackages, icon: '📋' },
  ];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={stats.lastTracking}
      keyExtractor={(item) => item.tracking}
      ListHeaderComponent={
        <>
          {/* Green welcome banner */}
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>{t('dashboard.welcome', { name: client?.name ?? '' })}</Text>
              <Text style={styles.bannerSubtitle}>{t('dashboard.welcomeSubtitle')}</Text>
            </View>
            {stats.logoUrl ? (
              <Image source={{ uri: stats.logoUrl }} style={styles.bannerLogo} resizeMode="contain" />
            ) : (
              <Text style={styles.bannerEmoji}>📦</Text>
            )}
          </View>

          {/* Stat cards with icons */}
          <View style={styles.grid}>
            {statCards.map((card) => (
              <View key={card.key} style={styles.card}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent packages header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t('dashboard.recent')}</Text>
            <Pressable onPress={() => router.push('/packages')}>
              <Text style={styles.viewAll}>{t('dashboard.viewAll')} →</Text>
            </Pressable>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/packages/${item.tracking}`)}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTracking}>{item.tracking}</Text>
            <Text style={styles.rowDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.rowStatus}>{t(`status.${item.status}`)}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>{t('packages.empty')}</Text>
        </View>
      }
      ListFooterComponent={
        <>
          {/* WhatsApp help section */}
          <Pressable
            style={styles.helpCard}
            onPress={() => Linking.openURL('https://wa.me/')}
          >
            <View style={styles.helpLeft}>
              <Text style={styles.helpIcon}>💬</Text>
              <View>
                <Text style={styles.helpTitle}>{t('dashboard.needHelp')}</Text>
                <Text style={styles.helpSubtitle}>{t('dashboard.helpSubtitle')}</Text>
              </View>
            </View>
            <View style={styles.helpButton}>
              <Text style={styles.helpButtonText}>{t('dashboard.contactWhatsApp')}</Text>
            </View>
          </Pressable>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 16 },
  retry: { backgroundColor: '#16a34a', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  banner: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  bannerContent: { flex: 1 },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, color: '#dcfce7', lineHeight: 18 },
  bannerLogo: { width: 60, height: 60, marginLeft: 12 },
  bannerEmoji: { fontSize: 48, marginLeft: 12, opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardIcon: { fontSize: 20, marginBottom: 8 },
  cardValue: { fontSize: 26, fontWeight: '800', color: '#16a34a' },
  cardLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  viewAll: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rowLeft: {},
  rowTracking: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
  rowDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rowStatus: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingVertical: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  helpCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  helpIcon: { fontSize: 28, marginRight: 12 },
  helpTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  helpSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  helpButton: {
    backgroundColor: '#25c866',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  helpButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
