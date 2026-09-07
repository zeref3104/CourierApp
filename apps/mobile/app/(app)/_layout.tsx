import { useEffect } from 'react';
import { Text } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { registerPushTokenForCurrentUser } from '@/lib/pushNotifications';
import { t } from '@/i18n';

function usePushTokenRegistration() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'authenticated') return;
    registerPushTokenForCurrentUser();
  }, [status]);
}

function TabIcon({ emoji }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  usePushTokenRegistration();
  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="packages"
        options={{
          title: t('tabs.myPackages'),
          tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-package"
        options={{
          title: t('tabs.newPackage'),
          tabBarIcon: ({ color }) => <TabIcon emoji="➕" color={color} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: t('tabs.support'),
          tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.myAccount'),
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
      {/* Hidden screens — accessible via navigation but not in tab bar */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="packages/[tracking]" options={{ href: null }} />
    </Tabs>
  );
}
