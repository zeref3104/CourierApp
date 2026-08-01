import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { authService } from '../../services/auth.service';
import { setCredentials } from '../../store/slices/authSlice';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type LoginForm = z.infer<ReturnType<typeof loginSchema>>;

// Built inside the component so validation messages follow the active language.
const loginSchema = (t: TFunction) =>
  z.object({
    email: z.string().email(t('auth.emailInvalid')),
    password: z.string().min(1, t('auth.passwordRequired')),
  });

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema(t)),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setLoading(true);
    try {
      const response = await authService.login(data);
      dispatch(setCredentials(response.data));
      if (response.data.user?.isClient) {
        navigate('/client');
      } else if (response.data.mustChangePassword) {
        navigate('/auth/change-password');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary-600">Courier Manager</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('auth.loginSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('auth.email')}
          type="email"
          placeholder="admin@courier.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label={t('auth.password')}
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {t('nav.login')}
        </Button>
      </form>
    </div>
  );
}
