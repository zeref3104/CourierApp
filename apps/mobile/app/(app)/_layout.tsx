import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { t } from '@/i18n';

/**
 * Protected area group. Everything under `(app)` requires an authenticated
 * session; the guard bounces unauthenticated users to /login. Slice 5b adds
 * the dashboard (index), package list (packages) and tracking detail
 * (packages/[tracking]) screens.
 */
export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('dashboard.title') }} />
      <Stack.Screen name="packages" options={{ title: t('packages.title') }} />
      <Stack.Screen name="packages/[tracking]" options={{ title: t('tracking.title') }} />
    </Stack>
  );
}
