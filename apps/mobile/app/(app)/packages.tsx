import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePackagesList } from '@/lib/packagesList';
import { t } from '@/i18n';

/**
 * Package list (client-panel-specs, task 5.5): GET /client/packages with a
 * status filter (chips) + pagination. Only the tracking, description and
 * status label are shown — amount fields are never rendered in the list.
 *
 * The list state (filter/items/meta/loading + pagination) lives in
 * `usePackagesList`, whose generation guard (verify-5b W1) drops any page
 * fetch that resolves after a filter switch, so stale items/meta can never be
 * appended onto a different filter's list.
 */
const FILTERS = [
  { value: undefined, labelKey: 'packages.filter.all' },
  { value: 'disponible', labelKey: 'status.disponible' },
  { value: 'en_reparto', labelKey: 'status.en_reparto' },
  { value: 'en_transito', labelKey: 'status.en_transito' },
  { value: 'entregado', labelKey: 'status.entregado' },
] as const;

export default function PackagesScreen() {
  const router = useRouter();
  const { state, changeFilter, loadFirst, loadMore } = usePackagesList();
  const { filter, items, loading, loadingMore, error } = state;

  useEffect(() => {
    loadFirst(filter);
  }, [filter, loadFirst]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable
              key={f.labelKey}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => changeFilter(f.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(f.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('packages.loadError')}</Text>
          <Pressable style={styles.retry} onPress={() => loadFirst(filter)}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/packages/${item.tracking}`)}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTracking}>{item.tracking}</Text>
                <Text style={styles.rowStatus}>{t(`status.${item.status}`)}</Text>
              </View>
              {item.description ? <Text style={styles.rowDesc}>{item.description}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('packages.empty')}</Text>}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#475569', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 16 },
  retry: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  rowTracking: { fontWeight: '700' },
  rowStatus: { color: '#2563eb' },
  rowDesc: { color: '#64748b', marginTop: 4, fontSize: 13 },
  empty: { color: '#64748b', textAlign: 'center', paddingVertical: 32 },
  footer: { marginVertical: 16 },
});
