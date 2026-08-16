import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { customerService } from '../../../services/customer.service';
import { branchService } from '../../../services/branch.service';
import { RootState } from '../../../store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const isEdit = Boolean(id);
  // Users with a fixed branch rely on the server-side branchId injection.
  // Users without one (e.g. admins) pick a branch explicitly.
  const showBranchSelect = !user?.branchId;
  const [branches, setBranches] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', lastName: '', document: '', phone: '',
    email: '', address: '', notes: '', branchId: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (showBranchSelect) {
      branchService.findAll({ limit: 100 }).then((r) => setBranches(r.data)).catch(() => {});
    }
  }, [showBranchSelect]);

  useEffect(() => {
    if (!id) return;
    customerService
      .findById(id)
      .then((res) => {
        const c = res.data;
        setForm({
          name: c.name || '',
          lastName: c.lastName || '',
          document: c.document || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          notes: c.notes || '',
          branchId: c.branchId?._id || c.branchId || '',
        });
      })
      .catch(() => alert(t('customers.loadError')))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, document: form.document.trim() || undefined, branchId: form.branchId || undefined };
      if (isEdit) {
        await customerService.update(id!, payload);
      } else {
        const res = await customerService.create(payload);
        navigate(`/customers/${res.data._id}`);
        return;
      }
      navigate(`/customers/${id}`);
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
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('customers.editTitle') : t('customers.new')}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label={t('common.lastName')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('common.document')} value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {showBranchSelect && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('common.branch')}</label>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">{t('common.selectBranch')}</option>
                {branches.filter((b: any) => b.isActive !== false).map((b: any) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <Input label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>{t('common.save')}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/customers')}>{t('common.cancel')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
