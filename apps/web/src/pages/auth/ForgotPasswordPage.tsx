import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type Step = 'email' | 'otp' | 'password';

// Built inside the component so validation messages follow the active
// language (RegisterPage pattern). The password rules mirror the shared
// passwordRules from @courier/validation (min 8, upper, lower, digit) so the
// client and server can never disagree on what "valid" means.
const emailSchema = (t: TFunction) =>
  z.object({
    email: z.string().email(t('auth.emailInvalid')),
    // Optional global client code: an email shared by clients in 2+ companies
    // resolves the 409 disambiguation (spec R2). Trimmed and upper-cased
    // before validation so users can type it freely.
    clientCode: z
      .string()
      .transform((value) => value.trim().toUpperCase())
      .refine((value) => value === '' || /^[A-Z]{2,5}-\d{6}$/.test(value), t('auth.forgot.clientCodeInvalid'))
      .optional(),
  });

const passwordSchema = (t: TFunction) =>
  z
    .object({
      newPassword: z
        .string()
        .min(8, t('auth.passwordMin'))
        .regex(/[A-Z]/, t('auth.passwordUpper'))
        .regex(/[a-z]/, t('auth.passwordLower'))
        .regex(/[0-9]/, t('auth.passwordDigit')),
      confirmPassword: z.string().min(1, t('auth.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('auth.passwordsNoMatch'),
      path: ['confirmPassword'],
    });

type EmailFormValues = z.infer<ReturnType<typeof emailSchema>>;
type PasswordFormValues = z.infer<ReturnType<typeof passwordSchema>>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otp, setOtp] = useState('');
  const [showClientCode, setShowClientCode] = useState(false);
  // Email + resolved client code carried from step 1 into the later steps;
  // the API needs them again on every forgot resend and on the final reset.
  const [target, setTarget] = useState<{ email: string; code?: string } | null>(null);

  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema(t)),
    mode: 'onBlur',
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema(t)),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /** Ask the API for a recovery code. The answer is generic by design
   * (anti-enumeration): `sent` is true even when no account matched. */
  const requestOtp = async (email: string, code?: string) => {
    const res = await authService.forgotPassword({ email, lang: i18n.language, code });
    setCooldown(res.data?.resendAfter ?? 60);
  };

  const onEmailSubmit = async (data: EmailFormValues) => {
    setError('');
    setLoading(true);
    try {
      const email = data.email.trim().toLowerCase();
      const code = data.clientCode || undefined;
      await requestOtp(email, code);
      setTarget({ email, code });
      setOtp('');
      setStep('otp');
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Ambiguous email — reveal the optional client-code field (spec R2).
        setShowClientCode(true);
        setError(t('auth.forgot.conflict'));
      } else if (err.response?.status === 429) {
        // OTP cooldown — arm the timer from the server's answer when present.
        const resendAfter = err.response?.data?.error?.details?.resendAfter;
        if (typeof resendAfter === 'number') setCooldown(resendAfter);
        setError(t('auth.forgot.errorGeneric'));
      } else {
        setError(t('auth.forgot.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !target) return;
    setError('');
    try {
      await requestOtp(target.email, target.code);
    } catch {
      setError(t('auth.forgot.errorGeneric'));
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!target) return;
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword({
        email: target.email,
        code: target.code,
        otpCode: otp,
        newPassword: data.newPassword,
      });
      navigate('/login');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setError(t('auth.forgot.conflict'));
      } else if (status === 422) {
        // One generic 422 for every failure (bad/expired/exhausted OTP,
        // unresolvable email) — never reveal which one it was.
        setError(t('auth.otpVerifyError'));
      } else {
        setError(t('auth.forgot.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'email', label: t('auth.forgot.stepEmail') },
    { key: 'otp', label: t('auth.forgot.stepCode') },
    { key: 'password', label: t('auth.forgot.stepPassword') },
  ];

  const currentStepIdx = steps.findIndex((s) => s.key === step);

  const goToEmailStep = () => {
    setStep('email');
    setOtp('');
    setError('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 md:p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-600">Courier Manager</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('auth.forgot.title')}</p>
      </div>

      <div role="list" className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5 sm:gap-2">
            <div
              role="listitem"
              aria-current={i === currentStepIdx ? 'step' : undefined}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium ${
                i <= currentStepIdx
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-[10px] sm:text-xs ${
                i <= currentStepIdx
                  ? 'text-primary-600 font-medium'
                  : 'text-gray-400 dark:text-gray-500'
              } hidden sm:inline`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-4 sm:w-6 h-px ${
                  i < currentStepIdx
                    ? 'bg-primary-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('auth.forgot.subtitle')}</p>

          <Input
            id="forgot-email"
            label={t('auth.email')}
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {showClientCode && (
            <Input
              id="forgot-clientCode"
              label={t('auth.forgot.clientCode')}
              placeholder="CS-000001"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              error={errors.clientCode?.message}
              {...register('clientCode')}
            />
          )}

          <Button type="submit" loading={loading} className="w-full">
            {t('auth.forgot.sendCode')}
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/login" className="text-primary-600 hover:underline">
              {t('nav.login')}
            </Link>
          </p>
        </form>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {t('auth.forgot.codeSent')} <span className="font-medium">{target?.email}</span>
          </p>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('auth.otpCode')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="000000"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="secondary" onClick={goToEmailStep} className="flex-1">
              {t('common.back')}
            </Button>
            <Button
              type="button"
              onClick={() => setStep('password')}
              disabled={otp.length !== 6}
              className="flex-1"
            >
              {t('auth.forgot.continue')}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
            <button type="button" onClick={goToEmailStep} className="text-primary-600 hover:underline">
              {t('auth.changeEmail')}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0}
              className="text-primary-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? t('auth.otpResendIn', { seconds: cooldown }) : t('auth.otpResend')}
            </button>
          </div>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
          <Input
            id="forgot-newPassword"
            label={t('auth.newPassword')}
            type="password"
            error={passwordErrors.newPassword?.message}
            {...registerPassword('newPassword')}
          />

          <Input
            id="forgot-confirmPassword"
            label={t('auth.confirmNewPassword')}
            type="password"
            error={passwordErrors.confirmPassword?.message}
            {...registerPassword('confirmPassword')}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep('otp');
                setError('');
              }}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t('auth.forgot.resetButton')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
