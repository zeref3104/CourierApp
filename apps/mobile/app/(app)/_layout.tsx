import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { registerPushTokenForCurrentUser } from '@/lib/pushNotifications';
import { t } from '@/i18n';

/**
 * Protected area group. Everything under `(app)` requires an authenticated
 * session; the guard bounces unauthenticated users to /login. Slice 5c adds
 * the notifications (notifications) and profile (profile) screens.
 */

/**
 * Fire-and-forget push token registration once per authenticated session
 * (task 5.7: "after login/register, in the authenticated area"). Runs on every
 * transition to `authenticated` — the registration lib dedups per token and
 * stays silent on permission-denied / missing projectId / network failures.
 */
function usePushTokenRegistration() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'authenticated') return;
    registerPushTokenForCurrentUser();
  }, [status]);
}

export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  usePushTokenRegistration();
  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('dashboard.title') }} />
      <Stack.Screen name="packages" options={{ title: t('packages.title') }} />
      <Stack.Screen name="packages/[tracking]" options={{ title: t('tracking.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
      <Stack.Screen name="profile" options={{ title: t('profile.title') }} />
    </Stack>
  );
}
