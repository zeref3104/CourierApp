import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { suggestClientPrefix } from '@courier/helpers';
import { CLIENT_CODE_PREFIX_PATTERN } from '@courier/constants';
import { companyService, Plan, CreateCompanyData } from '../../../services/company.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function CreateCompanyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    email: '',
    adminEmail: '',
    phone: '',
    planId: '',
    clientCodePrefix: '',
  });
  // Once the admin edits the prefix manually, stop re-suggesting it on name
  // changes so their override is preserved (design D2 — server stays authoritative).
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ adminEmail: string; defaultPassword: string } | null>(null);

  useEffect(() => {
    companyService.getPlans().then((res) => setPlans(res.data)).catch(() => {});
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug,
      clientCodePrefix: !prefixTouched ? suggestClientPrefix(name) : prev.clientCodePrefix,
    }));
  };

  const generateSlug = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Normalize the override to uppercase letters, max 5 chars — the server
  // validates the final value against ^[A-Z]{2,5}$.
  const handlePrefixChange = (value: string) => {
    setPrefixTouched(true);
    setForm((prev) => ({ ...prev, clientCodePrefix: value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.planId) {
      setError(t('companies.selectPlanRequired'));
      return;
    }

    if (form.clientCodePrefix && !new RegExp(CLIENT_CODE_PREFIX_PATTERN).test(form.clientCodePrefix)) {
      setError(t('companies.clientCodePrefixInvalid'));
      return;
    }

    setLoading(true);
    try {
      const data: CreateCompanyData = {
        name: form.name,
        slug: form.slug,
        email: form.email,
        adminEmail: form.adminEmail,
        phone: form.phone || undefined,
        planId: form.planId,
        clientCodePrefix: form.clientCodePrefix || undefined,
      };
      const res = await companyService.create(data);
      setSuccess({
        adminEmail: res.data.adminEmail || form.adminEmail,
        defaultPassword: res.data.defaultPassword || '123456',
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('companies.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/companies')}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {t('common.back')}
        </button>
        <h1 className="text-2xl font-bold">{t('companies.new')}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('companies.name')}
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('companies.namePlaceholder')}
            required
          />

          <Input
            label={t('companies.clientCodePrefix')}
            value={form.clientCodePrefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            placeholder={t('companies.clientCodePrefixPlaceholder')}
            maxLength={5}
          />
          <p className="text-xs text-gray-500 -mt-3">
            {t('companies.clientCodePrefixHint')}
          </p>

          <Input
            label={t('companies.slugLabel')}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={t('companies.slugPlaceholder')}
            required
          />
          {form.slug && (
            <p className="text-xs text-gray-500 -mt-3">
              {t('companies.databaseLabel')} <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">courier_{form.slug}</code>
            </p>
          )}

          <Input
            label={t('companies.companyEmail')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="info@miempresa.com"
            required
          />

          <Input
            label={t('companies.adminEmail')}
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            placeholder="admin@miempresa.com"
            required
          />

          <Input
            label={t('common.phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="809-555-5555"
          />

          <div>
            <label className="block text-sm font-medium mb-1">{t('companies.plan')}</label>
            <select
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">{t('companies.selectPlan')}</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.price > 0 ? t('companies.perMonth', { price: p.price }) : t('companies.free')}
                </option>
              ))}
            </select>
            {plans.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                {t('companies.noPlans')}
              </p>
            )}
          </div>

          {success && (
            <div className="bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-400 text-sm p-4 rounded-lg space-y-2">
              <p className="font-semibold">✅ {t('companies.createdSuccess')}</p>
              <p>{t('companies.adminLabel')} <strong>{success.adminEmail}</strong></p>
              <p>{t('companies.tempPasswordLabel')} <strong className="font-mono">{success.defaultPassword}</strong></p>
              <p className="text-xs text-green-600 dark:text-green-500">
                {t('companies.mustChangePasswordHint')}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {success ? (
              <Button type="button" onClick={() => navigate('/companies')}>
                {t('companies.backToList')}
              </Button>
            ) : (
              <>
                <Button type="submit" loading={loading} disabled={plans.length === 0}>
                  {t('companies.create')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/companies')}>
                  {t('common.cancel')}
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
