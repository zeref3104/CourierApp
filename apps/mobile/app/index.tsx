import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';

/**
 * Auth guard entry (expo-router `/`). Reads the resolved boot status:
 *   - unknown / restoring: lightweight blocker so the wrong screen never
 *     flashes before the boot restore + interceptor settle.
 *   - authenticated -> dashboard group `(app)`.
 *   - unauthenticated -> login.
 */
export default function Index() {
  const status = useAuthStore((s) => s.status);

  if (status === 'unknown' || status === 'restoring') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={status === 'authenticated' ? '/(app)' : '/login'} />;
}