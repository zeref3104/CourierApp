import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchNotifications, ClientNotification, NotificationType } from '@/api/clientNotifications';
import { t } from '@/i18n';

/**
 * Notifications screen (push-notifications spec, task 5.7): consumes
 * GET /client/notifications (paginated, in_app|push only) and renders the
 * client's own records — type label, title, message and timestamp.
 */
const NOTIFICATION_TYPES: NotificationType[] = ['package_status', 'payment', 'system', 'delivery'];

function typeLabel(type: string): string {
  // Known types have dedicated keys; anything unexpected falls back to a
  // generic label instead of leaking a raw key to the UI.
  return NOTIFICATION_TYPES.includes(type as NotificationType)
    ? t(`notifications.type.${type}`)
    : t('notifications.generic');
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const loadFirst = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const page = await fetchNotifications({ page: 1, limit: 20 });
      setItems(page.items);
      setMeta(page.meta);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (loadingMore || !meta || meta.page >= meta.totalPages) return;
    try {
      setLoadingMore(true);
      const page = await fetchNotifications({ page: meta.page + 1, limit: 20 });
      setItems((prev) => [...prev, ...page.items]);
      setMeta(page.meta);
    } catch {
      // Best-effort: keep the current list; the user can scroll again.
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('notifications.loadError')}</Text>
        <Pressable style={styles.retry} onPress={loadFirst}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item._id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowType}>{typeLabel(item.type)}</Text>
            <Text style={styles.rowDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowMessage}>{item.message}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t('notifications.empty')}</Text>}
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={styles.footer} /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  listContent: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 16 },
  retry: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowType: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  rowDate: { fontSize: 12, color: '#94a3b8' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowMessage: { fontSize: 13, color: '#475569', marginTop: 2 },
  empty: { color: '#64748b', textAlign: 'center', paddingVertical: 32 },
  footer: { marginVertical: 16 },
});
