import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { AxiosError } from 'axios';
import { loginClient, tenantContextFrom } from '@/api/clientAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { t } from '@/i18n';

/**
 * Login screen (client-code-login spec). Code + password ONLY — no email and
 * no company selector; the tenant is resolved server-side from the code's
 * prefix (design D9). On success the tokens go to the auth store (refresh →
 * keychain) and the tenant context is derived from the response and persisted
 * so restart keeps the correct x-tenant-slug header.
 */
export default function LoginScreen() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setTokens = useAuthStore((s) => s.setTokens);
  const setClient = useAuthStore((s) => s.setClient);
  const setTenant = useTenantStore((s) => s.setTenant);

  const onSubmit = async () => {
    setError(null);
    if (!code.trim()) {
      setError(t('clientLogin.codeRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const { accessToken, refreshToken, client } = await loginClient(code.trim(), password);
      // Persist refresh token + status first, then client profile and tenant.
      await setTokens(accessToken, refreshToken);
      setClient(client);
      // login response carries company slug/prefix but not company id;
      // empty id is acceptable — x-tenant-slug only needs the slug.
      await setTenant(tenantContextFrom(client, ''));
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 404) setError(t('clientLogin.error.codeNotFound'));
      else if (status === 401) setError(t('clientLogin.error.invalidCredentials'));
      else if (status === 403) setError(t('clientLogin.error.companyUnavailable'));
      else setError(t('clientLogin.error.generic'));
    } finally {
      setSubmitting(false);
    }
    // On success the auth store status flips to `authenticated`; the root
    // `index` guard <Redirect>s to the dashboard group. No manual nav.
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('clientLogin.title')}</Text>
      <Text style={styles.subtitle}>{t('clientLogin.subtitle')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('clientLogin.codePlaceholder')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="login-code"
      />
      <TextInput
        style={styles.input}
        placeholder={t('clientLogin.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="login-password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        disabled={submitting}
        onPress={onSubmit}
      >
        <Text style={styles.buttonText}>{t('clientLogin.signIn')}</Text>
      </Pressable>

      <Link href="/register" style={styles.link}>
        <Text style={styles.linkText}>{t('register.title')}</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: '#c00', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 15 },
});