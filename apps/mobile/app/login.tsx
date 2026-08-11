import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { AxiosError } from 'axios';
import { loginClient, tenantContextFrom } from '@/api/clientAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import * as authStorage from '@/lib/authStorage';
import {
  t, setI18nLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n';

/** Emoji flag per supported language (renders on iOS + Android 11+; the button
 * also shows the ISO code so the selector degrades gracefully on older OSes). */
const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  fr: '🇫🇷',
};

// Placeholders render with Android's hint color by default, which can be
// invisible against the input background on some devices/themes. Force an
// explicit grey so the field label is always visible in release builds.
const PLACEHOLDER_COLOR = '#94a3b8';

// Mirrors the register screen's client-side email check; only applied when the
// identifier actually looks like an email (contains "@").
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login screen (client-code-login spec, extended by client-email-login).
 * A single `identifier` field accepts the global client code OR the client
 * email, plus password — no company selector; the tenant is resolved
 * server-side (code: prefix lookup, email: master ClientEmailIndex). On
 * success the tokens go to the auth store (refresh → keychain) and the tenant
 * context is derived from the response and persisted so restart keeps the
 * correct x-tenant-slug header.
 *
 * The language selector lets the user pick the app language pre-login; the
 * choice is persisted and re-applied on boot (restoreSession).
 */
export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>(() => getCurrentLanguage());

  const setTokens = useAuthStore((s) => s.setTokens);
  const setClient = useAuthStore((s) => s.setClient);
  const setTenant = useTenantStore((s) => s.setTenant);

  const changeLanguage = async (lang: SupportedLanguage) => {
    setI18nLanguage(lang);
    setLanguage(lang);
    try {
      await authStorage.saveLanguage(lang);
    } catch {
      // Persistence failure is non-fatal: the choice still applies this session.
    }
  };

  const onSubmit = async () => {
    setError(null);
    const identifierValue = identifier.trim();
    if (!identifierValue) {
      setError(t('clientLogin.identifierRequired'));
      return;
    }
    // If the identifier looks like an email ("@"), require a basic format.
    if (identifierValue.includes('@') && !EMAIL_RE.test(identifierValue)) {
      setError(t('clientLogin.error.emailInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      const { accessToken, refreshToken, client } = await loginClient(identifierValue, password);
      // Persist refresh token + status first, then client profile and tenant.
      await setTokens(accessToken, refreshToken);
      setClient(client);
      // login response carries company slug/prefix but not company id;
      // empty id is acceptable — x-tenant-slug only needs the slug.
      try {
        await setTenant(tenantContextFrom(client, ''));
      } catch (tenantErr) {
        // The session already exists — never strand the user on a tenant
        // persistence hiccup. Surface a non-blocking notice only.
        console.warn('[login] failed to persist tenant context after successful sign in', tenantErr);
      }
      router.replace('/(app)');
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      const isEmailIdentifier = identifierValue.includes('@');
      if (status === 404)
        setError(isEmailIdentifier ? t('clientLogin.error.emailNotFound') : t('clientLogin.error.codeNotFound'));
      else if (status === 401) setError(t('clientLogin.error.invalidCredentials'));
      else if (status === 403) setError(t('clientLogin.error.companyUnavailable'));
      // 409 only occurs on the email path: the email maps to several companies,
      // so the user must fall back to their unambiguous client code.
      else if (status === 409) setError(t('clientLogin.error.emailAmbiguous'));
      else setError(t('clientLogin.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>{t('clientLogin.title')}</Text>
      <Text style={styles.subtitle}>{t('clientLogin.subtitle')}</Text>

      <View style={styles.languageBlock}>
        <Text style={styles.languageLabel}>{t('clientLogin.language')}</Text>
        <View style={styles.languageRow}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Pressable
              key={lang}
              style={[styles.languageButton, language === lang && styles.languageButtonActive]}
              onPress={() => changeLanguage(lang)}
              testID={`language-${lang}`}
              accessibilityLabel={`${LANGUAGE_FLAGS[lang]} ${lang.toUpperCase()}`}
            >
              <Text
                style={[styles.languageButtonText, language === lang && styles.languageButtonTextActive]}
              >
                {LANGUAGE_FLAGS[lang]} {lang.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextInput
        style={styles.input}
        placeholder={t('clientLogin.identifierPlaceholder')}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={identifier.includes('@') ? 'email-address' : 'default'}
        testID="login-identifier"
      />
      <TextInput
        style={styles.input}
        placeholder={t('clientLogin.password')}
        placeholderTextColor={PLACEHOLDER_COLOR}
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
  languageBlock: { marginBottom: 20 },
  languageLabel: { fontSize: 13, color: '#888', marginBottom: 6 },
  languageRow: { flexDirection: 'row', gap: 8 },
  languageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  languageButtonActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  languageButtonText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  languageButtonTextActive: { color: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: '#c00', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 15 },
});