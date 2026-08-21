import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fetchPackageByTracking, PackageDetail } from '@/api/clientPanel';
import { sortTimelineChronological, shouldShowAmountCard, pickupBranchOf, formatCurrency } from '@/lib/tracking';
import { t } from '@/i18n';

/**
 * Tracking detail (client-panel-specs, task 5.6): GET /client/packages/:tracking
 * renders the chronological PackageHistory timeline + pickup branch, and the
 * amount-to-pay card ONLY when the package is `disponible` (spec gate — for any
 * other status the backend strips amount fields and we must not render them).
 * The sort/gate/branch logic lives in pure helpers (src/lib/tracking.ts) so the
 * verify-5b rendering behaviours are unit-tested (task 5.10).
 */
export default function TrackingDetailScreen() {
  const { tracking } = useLocalSearchParams<{ tracking: string }>();
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setPkg(await fetchPackageByTracking(tracking));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tracking]);

  useEffect(() => {
    load();
  }, [load]);

  // Backend returns history sorted newest-first; the spec timeline must be
  // chronological (oldest -> newest).
  const timeline = useMemo(() => (pkg ? sortTimelineChronological(pkg.history) : []), [pkg]);

  const showAmountCard = pkg ? shouldShowAmountCard(pkg) : false;
  const pickupBranch = pkg ? pickupBranchOf(pkg) : null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !pkg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.tracking}>{t('tracking.tracking')}: {pkg.tracking}</Text>
      <Text style={[styles.status, { color: '#2563eb' }]}>{t(`status.${pkg.status}`)}</Text>

      {showAmountCard ? (
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{t('tracking.amountToPay')}</Text>
          <Text style={styles.amountValue}>{formatCurrency(Number(pkg.amountToPay), pkg.currency)}</Text>
          {pickupBranch ? (
            <>
              <Text style={styles.branchTitle}>{t('tracking.pickupBranch')}</Text>
              <Text style={styles.branchText}>{pickupBranch.name}</Text>
              {pickupBranch.address ? (
                <Text style={styles.branchText}>{pickupBranch.address}</Text>
              ) : null}
            </>
          ) : null}
          <Text style={styles.payAtPickup}>{t('tracking.payAtPickup')}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{t('tracking.timeline')}</Text>
      {timeline.length === 0 ? (
        <Text style={styles.empty}>{t('tracking.noHistory')}</Text>
      ) : (
        timeline.map((entry, idx) => (
          <View key={`${entry.createdAt}-${idx}`} style={styles.timelineRow}>
            <View style={styles.dot} />
            <View style={styles.timelineBody}>
              <Text style={styles.timelineStatus}>{t(`status.${entry.status}`)}</Text>
              <Text style={styles.timelineDate}>{new Date(entry.createdAt).toLocaleString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 16 },
  retry: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  tracking: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  status: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  amountCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  amountLabel: { fontSize: 13, color: '#475569' },
  amountValue: { fontSize: 32, fontWeight: '800', color: '#1d4ed8', marginVertical: 4 },
  branchTitle: { fontSize: 13, color: '#475569', marginTop: 8 },
  branchText: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  payAtPickup: { fontSize: 12, color: '#2563eb', marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  empty: { color: '#64748b', paddingVertical: 8 },
  timelineRow: { flexDirection: 'row', marginBottom: 16 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    marginTop: 5,
    marginRight: 12,
  },
  timelineBody: { flex: 1 },
  timelineStatus: { fontWeight: '600', fontSize: 15 },
  timelineDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
});
