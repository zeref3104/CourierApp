import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AxiosError } from 'axios';
import {
  fetchPublicCompanies, fetchPublicBranches, sendOtp, verifyOtp, registerClient,
  tenantContextFrom, type PublicCompany, type PublicBranch,
} from '@/api/clientAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { t } from '@/i18n';

/**
 * Registration + OTP flow (client-registration spec). Sequence:
 *   1. Pick a company (GET /public/companies) and its active branch
 *      (GET /public/companies/:id/branches).
 *   2. Fill the personal form (name/email/phone/document/password) and request
 *      an email OTP.
 *   3. Verify the OTP; "Create account" stays disabled until verified.
 *   4. POST /auth/client/register (auto-login) -> tokens persisted + logged in.
 * The account is NEVER created before the OTP verifies (spec guard).
 */
type Step = 'company' | 'form' | 'otp';

export default function RegisterScreen() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setClient = useAuthStore((s) => s.setClient);
  const setTenant = useTenantStore((s) => s.setTenant);

  const [step, setStep] = useState<Step>('company');
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [branch, setBranch] = useState<PublicBranch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPublicCompanies()
      .then(setCompanies)
      .catch(() => setLoadError(t('register.loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCompany = async (c: PublicCompany) => {
    setCompany(c);
    setBranches([]);
    setBranch(null);
    try {
      const list = await fetchPublicBranches(c.id);
      setBranches(list);
      setStep('form');
    } catch {
      setLoadError(t('register.branchesLoadError'));
    }
  };

  const requestOtp = async () => {
    setOtpError(null);
    if (!email.trim()) {
      setOtpError(t('register.emailRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await sendOtp(email.trim(), 'en');
      setStep('otp');
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setOtpError(status === 429 ? t('otp.cooldownError') : t('register.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmOtp = async () => {
    setOtpError(null);
    setSubmitting(true);
    try {
      await verifyOtp(email.trim(), otpCode);
      setOtpVerified(true);
    } catch {
      setOtpError(t('otp.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistration = async () => {
    if (!company || !branch || !otpVerified) return;
    setOtpError(null);
    setSubmitting(true);
    try {
      const result = await registerClient({
        companyId: company.id,
        branchId: branch.id,
        name: name.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        otpCode,
        document: document.trim() || undefined,
      });
      await setTokens(result.accessToken, result.refreshToken);
      setClient(result.client);
      // Registration knows the selected company's id + slug, so the full tenant
      // context is persisted for x-tenant-slug on later /client/* calls.
      await setTenant(tenantContextFrom(result.client, company.id, company.slug));
    } catch (err: unknown) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 409) setOtpError(t('register.error.emailExists'));
      else if (status === 422) setOtpError(t('register.error.invalidOtp'));
      else if (status === 404) setOtpError(t('register.error.generic'));
      else setOtpError(t('register.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'company') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('register.title')}</Text>
        <Text style={styles.subtitle}>{t('register.subtitle')}</Text>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        {companies.map((c) => (
          <Pressable key={c.id} style={styles.card} onPress={() => selectCompany(c)}>
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.cardSub}>{c.slug}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  if (step === 'form') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t('register.selectBranch')}</Text>
          {branches.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.card, branch?.id === b.id && styles.cardSelected]}
              onPress={() => setBranch(b)}
            >
              <Text style={styles.cardTitle}>{b.name}</Text>
              {b.address ? <Text style={styles.cardSub}>{b.address}</Text> : null}
            </Pressable>
          ))}

          <TextInput style={styles.input} placeholder={t('register.name')} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder={t('register.lastName')} value={lastName} onChangeText={setLastName} />
          <TextInput style={styles.input} placeholder={t('register.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder={t('register.document')} value={document} onChangeText={setDocument} />
          <TextInput style={styles.input} placeholder={t('register.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder={t('register.password')} value={password} onChangeText={setPassword} secureTextEntry />

          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={requestOtp}>
            <Text style={styles.buttonText}>{t('otp.verify')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('otp.title')}</Text>
        <Text style={styles.subtitle}>{t('otp.subtitle', { email })}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('otp.codePlaceholder')}
          value={otpCode}
          onChangeText={setOtpCode}
          keyboardType="number-pad"
        />
        {otpError ? <Text style={styles.error}>{otpError}</Text> : null}
        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={confirmOtp}>
          <Text style={styles.buttonText}>{t('otp.verify')}</Text>
        </Pressable>
        {otpVerified ? (
          <Pressable
            style={[styles.button, styles.buttonPrimary, submitting && styles.buttonDisabled]}
            disabled={submitting}
            onPress={submitRegistration}
          >
            <Text style={styles.buttonText}>{t('register.createAccount')}</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  card: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8, padding: 14, marginBottom: 10 },
  cardSelected: { borderColor: '#2563eb' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 13, color: '#888' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 10 },
  error: { color: '#c00', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonPrimary: { backgroundColor: '#16a34a' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});