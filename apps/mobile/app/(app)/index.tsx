import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';

/**
 * Placeholder dashboard. The real dashboard (four stats + package list) ships
 * in slice 5b (task 5.5). Landing here after login/register proves the auth
 * gate and tenant-persistence plumbing work end-to-end (spec: "login by code
 * opens the dashboard route"); logout exercises the tenant/token wipe.
 */
export default function DashboardScreen() {
  const client = useAuthStore((s) => s.client);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const tenant = useTenantStore((s) => s.tenant);

  const onLogout = async () => {
    await clearAuth();
    // status flips to unauthenticated → (app) guard redirects to /login.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {client?.name}</Text>
      <Text style={styles.code}>{client?.code}</Text>
      {tenant?.companySlug ? <Text style={styles.sub}>Company: {tenant.companySlug}</Text> : null}
      <Text style={styles.badge}>Dashboard ships in slice 5b.</Text>
      <Pressable style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  code: { fontSize: 18, color: '#2563eb', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 8 },
  badge: { color: '#888', marginBottom: 24 },
  logout: { backgroundColor: '#dc2626', padding: 12, borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: '600' },
});