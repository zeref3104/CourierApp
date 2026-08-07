import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSessionBootstrap } from '@/lib/session';

/**
 * Root navigation container. `useSessionBootstrap` fires the single boot-time
 * restore (tenant + refresh token), then the stack renders. The `index` route
 * is a thin guard that redirects based on the resolved auth status
 * (unknown -> splash, authenticated -> dashboard group, else -> login).
 */
export default function RootLayout() {
  useSessionBootstrap();

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: '' }} />
      </Stack>
    </>
  );
}