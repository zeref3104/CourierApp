import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authService } from '../../services/auth.service';
import { logout } from '../../store/slices/authSlice';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Error al cambiar la contraseña'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await authService.logout();
    } catch {}
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary-600">Cambiar Contraseña</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Por seguridad, debes cambiar tu contraseña temporal
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Contraseña actual"
          type="password"
          placeholder="••••••••"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          required
        />

        <Input
          label="Nueva contraseña"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          required
        />

        <Input
          label="Confirmar nueva contraseña"
          type="password"
          placeholder="Repite la nueva contraseña"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" loading={loading} className="flex-1">
            Cambiar contraseña
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
