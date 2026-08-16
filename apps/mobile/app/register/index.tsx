import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { AxiosError } from 'axios';
import {
  fetchPublicCompanies, fetchPublicBranches, sendOtp, verifyOtp, registerClient,
  tenantContextFrom, type PublicCompany, type PublicBranch,
} from '@/api/clientAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { t, getCurrentLanguage } from '@/i18n';

/**
 * Registration + OTP flow (client-registration spec). Sequence:
 *   1. Pick a company (GET /public/companies) and its active branch
 *      (GET /public/companies/:id/branches). Companies with no active
 *      branches show a single "Principal" option; the backend then falls
 *      back to the company's main branch (or self-heals a zero-branch
 *      tenant with a "Principal" branch).
 *   2. Fill the personal form (name/lastName/phone/email/password) and request
 *      an email OTP. Every field is validated client-side mirroring the
 *      backend zod rules BEFORE any request fires, so users get field-level
 *      messages instead of opaque 400s.
 *   3. Verify the OTP; "Create account" stays disabled until verified.
 *   4. POST /auth/client/register (auto-login) -> tokens persisted + logged
 *      in, then the user is navigated to the dashboard. A successful response
 *      ALWAYS navigates (the account exists), even if tenant persistence fails.
 * The account is NEVER created before the OTP verifies (spec guard).
 */
type Step = 'company' | 'form' | 'otp';

// Backend resend cooldown is 60s (otp.service OTP_COOLDOWN_MS); sendOtp
// returns the authoritative resendAfter, this is the fallback.
const OTP_RESEND_COOLDOWN_SECONDS = 60;

// Mirrors packages/validation registerClientSchema exactly (names 2-50, phone
// 7-20, email format, password 8 + upper/lower/digit, OTP 6 digits).
const NAME_MAX_LENGTH = 50;
const PHONE_MAX_LENGTH = 20;

type FieldErrors = Partial<Record<'name' | 'lastName' | 'phone' | 'email' | 'password' | 'confirmPassword', string>>;

// Placeholders render with Android's hint color by default, which can be
// invisible against the input background on some devices/themes. Force an
// explicit grey so the field label is always visible in release builds.
const PLACEHOLDER_COLOR = '#94a3b8';

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPublicCompanies()
      .then(setCompanies)
      .catch(() => setLoadError(t('register.loadError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the resend cooldown once per second while on the OTP step.
  useEffect(() => {
    if (step !== 'otp' || resendCountdown <= 0) return;
    const id = setTimeout(() => setResendCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [step, resendCountdown]);

  /**
   * Client-side field validation mirroring the backend zod rules
   * (registerClientSchema), so bad input is caught BEFORE any request instead
   * of surfacing as an opaque 400 VALIDATION_ERROR.
   */
  const validateRegistrationForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    const firstName = name.trim();
    const secondName = lastName.trim();
    const phoneValue = phone.trim();
    const emailValue = email.trim();

    if (firstName.length < 2) errors.name = t('register.error.nameTooShort');
    if (secondName.length < 2) errors.lastName = t('register.error.lastNameTooShort');
    // Length-only check: the backend zod rule is min(7).max(20) with no charset,
    // so client validation must never reject what the server accepts.
    const phoneLength = phoneValue.trim().length;
    if (phoneLength < 7 || phoneLength > 20) errors.phone = t('register.error.invalidPhone');
    if (!emailValue) errors.email = t('register.emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) errors.email = t('register.emailInvalid');
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      errors.password = t('register.error.weakPassword');
    }
    // Prevent accounts the user can't log into.
    if (confirmPassword !== password) errors.confirmPassword = t('register.error.passwordMismatch');

    return errors;
  };

  const selectCompany = async (c: PublicCompany) => {
    setCompany(c);
    setBranches([]);
    setBranch(null);
    try {
      const list = await fetchPublicBranches(c.id);
      setBranches(list);
      // Preselect so "Create account" never stalls silently: first active
      // branch, or the "Principal" placeholder when the list is empty (the
      // backend then resolves the main branch / self-heals a zero-branch
      // tenant). The user can still change the pick.
      if (list.length > 0) {
        setBranch(list[0]);
      } else {
        setBranch({ id: '', name: t('register.principal') });
      }
      setStep('form');
    } catch {
      setLoadError(t('register.branchesLoadError'));
    }
  };

  const requestOtp = async () => {
    setOtpError(null);
    const errors = validateRegistrationForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      // Send the OTP email in the app's active language (design D6).
      const result = await sendOtp(email.trim(), getCurrentLanguage());
      setOtpVerified(false);
      setOtpCode('');
      setOtpNotice(t('otp.sent'));
      setResendCountdown(result.resendAfter ?? OTP_RESEND_COOLDOWN_SECONDS);
      setStep('otp');
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setOtpError(status === 429 ? t('otp.cooldownError') : t('register.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (resendCountdown > 0 || submitting) return;
    setOtpError(null);
    setSubmitting(true);
    try {
      const result = await sendOtp(email.trim(), getCurrentLanguage());
      // A fresh code invalidates the previous one: reset verification state.
      setOtpVerified(false);
      setOtpCode('');
      setOtpError(null);
      setOtpNotice(t('otp.sent'));
      setResendCountdown(result.resendAfter ?? OTP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      setOtpError(status === 429 ? t('otp.cooldownError') : t('register.error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const backToForm = () => {
    // Return to the form WITHOUT losing the typed data; the OTP state resets
    // so the user must request + verify a fresh code after editing.
    setOtpCode('');
    setOtpVerified(false);
    setOtpError(null);
    setOtpNotice(null);
    setStep('form');
  };

  const confirmOtp = async () => {
    setOtpError(null);
    const code = otpCode.trim();
    // Reject a malformed code client-side (format), not as a generic verify error.
    if (!/^\d{6}$/.test(code)) {
      setOtpError(t('otp.invalidFormat'));
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtp(email.trim(), code);
      setOtpVerified(true);
      setOtpNotice(null);
    } catch {
      // All backend OTP failures carry the same UNPROCESSABLE_ENTITY code, so
      // there is nothing granular to distinguish; the format case is fixed above.
      setOtpError(t('otp.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistration = async () => {
    if (!company || !otpVerified) return;
    if (!branch) {
      // Defensive: the "Principal" option is auto-selected on empty branch
      // lists, so this should be unreachable — never fail silently if it is.
      setOtpError(t('register.error.selectBranch'));
      return;
    }
    // Defensive re-validation: if the user edited the form after requesting the
    // OTP and came back, the account must not be submitted against bad fields.
    const errors = validateRegistrationForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStep('form');
      return;
    }
    setOtpError(null);
    setSubmitting(true);
    try {
      const result = await registerClient({
        companyId: company.id,
        // The "Principal" option has no real id (empty list): let the backend
        // resolve the main branch / self-heal a zero-branch tenant.
        branchId: branch.id || undefined,
        name: name.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        otpCode: otpCode.trim(),
        document: document.trim() || undefined,
      });
      // The account ALREADY exists server-side at this point (201). Token and
      // tenant persistence are best-effort: a local storage hiccup must NEVER
      // strand the user on the OTP step with a phantom "registration failed"
      // (the account exists, retrying would only produce a 409). Persist what
      // we can, warn on the rest, and always navigate to the dashboard.
      try {
        await setTokens(result.accessToken, result.refreshToken);
      } catch (tokenErr) {
        console.warn('[register] failed to persist tokens after successful registration', tokenErr);
      }
      setClient(result.client);
      // Registration knows the selected company's id + slug, so the full tenant
      // context is persisted for x-tenant-slug on later /client/* calls.
      try {
        await setTenant(tenantContextFrom(result.client, company.id, company.slug));
      } catch (tenantErr) {
        // The account + session already exist — never strand the user on a
        // tenant persistence hiccup. Surface a non-blocking notice only.
        console.warn('[register] failed to persist tenant context after successful registration', tenantErr);
      }
      router.replace('/(app)');
    } catch (err: unknown) {
      const status = (err as AxiosError)?.response?.status;
      if (status === 409) setOtpError(t('register.error.emailExists'));
      else if (status === 422) setOtpError(t('register.error.invalidOtp'));
      else if (status === 404) setOtpError(t('register.error.companyNotFound'));
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
          {branches.length === 0 ? (
            // No active branches: offer the company's main branch. The empty id
            // signals the backend to resolve it (auth.service.registerClient).
            <Pressable
              style={[styles.card, branch?.id === '' && styles.cardSelected]}
              onPress={() => setBranch({ id: '', name: t('register.principal') })}
            >
              <Text style={styles.cardTitle}>{t('register.principal')}</Text>
            </Pressable>
          ) : (
            branches.map((b) => (
              <Pressable
                key={b.id}
                style={[styles.card, branch?.id === b.id && styles.cardSelected]}
                onPress={() => setBranch(b)}
              >
                <Text style={styles.cardTitle}>{b.name}</Text>
                {b.address ? <Text style={styles.cardSub}>{b.address}</Text> : null}
              </Pressable>
            ))
          )}

          <TextInput style={styles.input} placeholder={t('register.name')} placeholderTextColor={PLACEHOLDER_COLOR} value={name} onChangeText={setName} maxLength={NAME_MAX_LENGTH} />
          {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
          <TextInput style={styles.input} placeholder={t('register.lastName')} placeholderTextColor={PLACEHOLDER_COLOR} value={lastName} onChangeText={setLastName} maxLength={NAME_MAX_LENGTH} />
          {fieldErrors.lastName ? <Text style={styles.fieldError}>{fieldErrors.lastName}</Text> : null}
          <TextInput style={styles.input} placeholder={t('register.phone')} placeholderTextColor={PLACEHOLDER_COLOR} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={PHONE_MAX_LENGTH} />
          {fieldErrors.phone ? <Text style={styles.fieldError}>{fieldErrors.phone}</Text> : null}
          <TextInput style={styles.input} placeholder={t('register.document')} placeholderTextColor={PLACEHOLDER_COLOR} value={document} onChangeText={setDocument} />
          <TextInput style={styles.input} placeholder={t('register.email')} placeholderTextColor={PLACEHOLDER_COLOR} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
          <TextInput style={styles.input} placeholder={t('register.password')} placeholderTextColor={PLACEHOLDER_COLOR} value={password} onChangeText={setPassword} secureTextEntry />
          {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
          <TextInput style={styles.input} placeholder={t('register.confirmPassword')} placeholderTextColor={PLACEHOLDER_COLOR} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}

          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
          <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={requestOtp}>
            <Text style={styles.buttonText}>{t('register.sendCode')}</Text>
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
          placeholderTextColor={PLACEHOLDER_COLOR}
          value={otpCode}
          onChangeText={setOtpCode}
          keyboardType="number-pad"
          maxLength={6}
        />
        {otpError ? <Text style={styles.error}>{otpError}</Text> : null}
        {otpNotice ? <Text style={styles.notice}>{otpNotice}</Text> : null}
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

        <Pressable
          style={[styles.resendButton, (resendCountdown > 0 || submitting) && styles.buttonDisabled]}
          disabled={resendCountdown > 0 || submitting}
          onPress={resendOtp}
        >
          <Text style={styles.resendButtonText}>
            {resendCountdown > 0 ? t('otp.resendIn', { seconds: resendCountdown }) : t('otp.resend')}
          </Text>
        </Pressable>
        <Pressable style={styles.linkButton} disabled={submitting} onPress={backToForm}>
          <Text style={styles.linkButtonText}>{t('register.changeEmail')}</Text>
        </Pressable>
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
  fieldError: { color: '#c00', fontSize: 12, marginTop: -6, marginBottom: 8 },
  error: { color: '#c00', marginBottom: 12 },
  notice: { color: '#16a34a', marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonPrimary: { backgroundColor: '#16a34a' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendButton: { alignItems: 'center', paddingVertical: 10, marginBottom: 6 },
  resendButtonText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: 10 },
  linkButtonText: { color: '#64748b', fontSize: 14 },
});