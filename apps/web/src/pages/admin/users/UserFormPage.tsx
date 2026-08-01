import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { userService } from '../../../services/user.service';
import { roleService } from '../../../services/role.service';
import { branchService } from '../../../services/branch.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const isEdit = Boolean(id);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', password: '',
    roleId: '', branchId: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    Promise.all([
      roleService.findAll(),
      branchService.findAll({ limit: 100 }),
    ])
      .then(([rolesRes, branchesRes]) => {
        setRoles(rolesRes.data);
        setBranches(branchesRes.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    userService
      .findById(id)
      .then((res) => {
        const u = res.data;
        setForm({
          name: u.name || '',
          lastName: u.lastName || '',
          email: u.email || '',
          password: '',
          roleId: u.roleId?._id || u.roleId || '',
          branchId: u.branchId?._id || u.branchId || '',
        });
      })
      .catch(() => alert(t('users.loadError')))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await userService.update(id!, {
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          roleId: form.roleId,
          branchId: form.branchId || undefined,
        });
      } else {
        await userService.create({
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          branchId: form.branchId || undefined,
        });
      }
      navigate('/users');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('users.editTitle') : t('users.new')}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label={t('common.lastName')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          {!isEdit && (
            <Input
              label={t('auth.password')}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder={t('validation.passwordStrengthHint')}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('users.role')}</label>
              <select
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                required
              >
                <option value="">{t('users.selectRole')}</option>
                {roles.map((r: any) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('common.branch')}</label>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">{t('common.selectBranch')}</option>
                {branches.filter((b: any) => b.isActive !== false).map((b: any) => (
                  <option key={b._id} value={b._id}>{b.name} - {b.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>{t('common.save')}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/users')}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
