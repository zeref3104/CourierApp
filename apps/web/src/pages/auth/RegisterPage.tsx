import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { authService } from '../../services/auth.service';
import { setCredentials } from '../../store/slices/authSlice';
import { saveClientRefreshToken } from '../../utils/clientAuthStorage';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { PublicCompany, PublicBranch } from '../../types/auth';

type Step = 'company' | 'form' | 'otp';

type FormValues = {
  name: string;
  lastName: string;
  phone: string;
  document?: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const registerSchema = (t: TFunction) =>
  z
    .object({
      name: z.string().min(2, t('auth.nameMin')).max(50),
      lastName: z.string().min(2, t('auth.lastNameMin')).max(50),
      phone: z.string().min(7, t('auth.phoneMin')).max(20),
      document: z.string().max(30).optional(),
      email: z.string().email(t('auth.emailInvalid')),
      password: z
        .string()
        .min(8, t('auth.passwordMin'))
        .regex(/[A-Z]/, t('auth.passwordUpper'))
        .regex(/[a-z]/, t('auth.passwordLower'))
        .regex(/[0-9]/, t('auth.passwordDigit')),
      confirmPassword: z.string().min(1, t('auth.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.passwordsNoMatch'),
      path: ['confirmPassword'],
    });

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('company');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema(t)),
    mode: 'onBlur',
  });

  const emailValue = watch('email');

  useEffect(() => {
    authService
      .getPublicCompanies()
      .then((res) => setCompanies(res.data))
      .catch(() => setError(t('auth.registerError')))
      .finally(() => setLoadingCompanies(false));
  }, [t]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoadingBranches(true);
    setBranches([]);
    setSelectedBranchId('');
    authService
      .getPublicBranches(selectedCompanyId)
      .then((res) => {
        setBranches(res.data);
        if (res.data.length === 1) {
          setSelectedBranchId(res.data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCompanyContinue = () => {
    if (!selectedCompanyId) return;
    setStep('form');
  };

  const onFormSubmit = async (data: FormValues) => {
    setError('');
    setLoading(true);
    try {
      await authService.sendOtp({ email: data.email, lang: i18n.language });
      setCooldown(60);
      setStep('otp');
    } catch {
      setError(t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const verifyRes = await authService.verifyOtp({ email: watch('email'), code: otp });
      if (!verifyRes.data?.verified) {
        setError(t('auth.otpVerifyError'));
        return;
      }

      const formData = watch();
      const registerRes = await authService.registerClient({
        companyId: selectedCompanyId,
        branchId: selectedBranchId || undefined,
        name: formData.name,
        lastName: formData.lastName,
        phone: formData.phone,
        document: formData.document || undefined,
        email: formData.email,
        password: formData.password,
        otpCode: otp,
      });

      const { accessToken, refreshToken, client } = registerRes.data;
      saveClientRefreshToken(refreshToken);
      dispatch(
        setCredentials({
          accessToken,
          user: {
            id: client.id,
            name: client.name,
            email: formData.email,
            role: 'client',
            roleName: client.code,
            permissions: [],
            isClient: true,
            clientId: client.id,
          },
        })
      );
      navigate('/client');
    } catch (err: any) {
      const errData = err.response?.data?.error;
      const msg: string = errData?.message ?? '';
      // API sends 422 with messages like "Invalid OTP code", "OTP expired", "OTP already used"
      if (/^(OTP|Invalid OTP)/.test(msg)) {
        setError(t('auth.otpVerifyError'));
      } else if (errData?.code === 'CONFLICT' && /already registered/i.test(msg)) {
        setError(t('register.error.emailExists'));
      } else {
        setError(t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    try {
      await authService.sendOtp({ email: watch('email'), lang: i18n.language });
      setCooldown(60);
    } catch {
      setError(t('auth.registerError'));
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'company', label: t('auth.stepCompany') },
    { key: 'form', label: t('auth.stepDetails') },
    { key: 'otp', label: t('auth.stepVerify') },
  ];

  const currentStepIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 md:p-8 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-600">Courier Manager</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('auth.registerSubtitle')}</p>
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

      {step === 'company' && (
        <div className="space-y-4">
          {loadingCompanies ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          ) : companies.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('auth.noCompanies')}
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('auth.selectCompany')}
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">{t('register.selectCompanyPlaceholder')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCompanyId && (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('auth.selectBranch')}
                  </label>
                  {loadingBranches ? (
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  ) : branches.length > 0 ? (
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">{t('register.selectBranchPlaceholder')}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('auth.noBranches')}
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={handleCompanyContinue}
                disabled={!selectedCompanyId}
                className="w-full"
              >
                {t('common.next')}
              </Button>
            </>
          )}
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="register-name"
              label={t('auth.name')}
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              id="register-lastName"
              label={t('auth.lastName')}
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="register-phone"
              label={t('auth.phone')}
              type="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              id="register-document"
              label={t('auth.document')}
              error={errors.document?.message}
              {...register('document')}
            />
          </div>

          <Input
            id="register-email"
            label={t('auth.email')}
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="register-password"
            label={t('auth.password')}
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            id="register-confirmPassword"
            label={t('auth.confirmPassword')}
            type="password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep('company')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {t('common.next')}
            </Button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            {t('auth.otpSent')} <span className="font-medium">{emailValue}</span>
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep('form');
                setOtp('');
                setError('');
              }}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={handleVerify}
              loading={loading}
              disabled={otp.length !== 6}
              className="flex-1"
            >
              {t('auth.otpVerify')}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setOtp('');
                setError('');
              }}
              className="text-primary-600 hover:underline"
            >
              {t('auth.changeEmail')}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0}
              className="text-primary-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? t('auth.otpResendIn', { seconds: cooldown }) : t('auth.otpResend')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
