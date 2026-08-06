import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * Protected area group. Everything under `(app)` requires an authenticated
 * session; the guard bounces unauthenticated users to /login. The dashboard
 * itself (stats + package list) is slice 5b — today this group only proves the
 * auth gate and tenant header plumbing.
 */
export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Courier' }} />
    </Stack>
  );
}