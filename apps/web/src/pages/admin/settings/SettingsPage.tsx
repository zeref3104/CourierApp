import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import LanguageSwitcher from '../../../components/settings/LanguageSwitcher';
import { setLanguage, isSupportedLanguage, type SupportedLanguage } from '../../../i18n';

const CURRENCY_SYMBOLS: Record<string, string> = {
  DOP: 'RD$',
  USD: 'US$',
  EUR: '€',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    company_name: '', company_address: '', company_phone: '', company_email: '', rnc: '', currency: 'DOP',
    price_per_lb: '', minimum_price: '', tax_rate: '',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const currencySymbol = CURRENCY_SYMBOLS[form.currency] || form.currency;

  const currencyOptions = [
    { code: 'DOP', symbol: 'RD$', name: t('settings.currencyDop') },
    { code: 'USD', symbol: 'US$', name: t('settings.currencyUsd') },
    { code: 'EUR', symbol: '€', name: t('settings.currencyEur') },
  ];

  useEffect(() => {
    import('../../../config/axios').then(({ default: api }) => {
      api.get('/settings').then((r) => {
        const s = r.data.data || {};
        const currency = s.currency || 'DOP';
        localStorage.setItem('currency', currency);
        // Adopt the tenant language only when the user has no explicit local
        // preference, keeping the localStorage-first flow intact.
        if (isSupportedLanguage(s.language) && !localStorage.getItem('language')) {
          setLanguage(s.language);
        }
        setForm({
          company_name: s.company_name || '',
          company_address: s.company_address || '',
          company_phone: s.company_phone || '',
          company_email: s.company_email || '',
          rnc: s.rnc || '',
          currency,
          price_per_lb: s.price_per_lb?.toString() || '',
          minimum_price: s.minimum_price?.toString() || '',
          tax_rate: s.tax_rate?.toString() || '',
        });
      }).catch(() => {});
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { default: api } = await import('../../../config/axios');
      const { price_per_lb, minimum_price, tax_rate, ...rest } = form;
      const payload = {
        ...rest,
        price_per_lb: price_per_lb === '' ? undefined : Number(price_per_lb),
        minimum_price: minimum_price === '' ? undefined : Number(minimum_price),
        tax_rate: tax_rate === '' ? undefined : Number(tax_rate),
      };
      await api.patch('/settings', payload);
      localStorage.setItem('currency', form.currency);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || t('settings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    try {
      const { default: api } = await import('../../../config/axios');
      await api.patch('/settings', { language: lang });
    } catch (err) {
      // The language still applies locally, but the backend was NOT updated —
      // surface it instead of swallowing, or customer emails keep the old language.
      console.error('[settings] Failed to persist tenant language on the server:', err);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('settings.companyName')} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input label={t('settings.address')} value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} />
          <Input label={t('settings.phone')} value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
          <Input label={t('settings.email')} type="email" value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} />
          <Input label={t('settings.rnc')} value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })} placeholder="101-00000-0" />
          <div>
            <label className="block text-sm font-medium mb-1">{t('settings.currency')}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.code} ({option.symbol}) - {option.name}</option>
              ))}
            </select>
          </div>
          <hr className="my-6 border-gray-200 dark:border-gray-700" />
          <h2 className="text-lg font-semibold mb-4">{t('settings.pricesTitle')}</h2>

          <Input
            label={`${t('settings.pricePerLb')} (${currencySymbol})`}
            type="number"
            step="0.01"
            min="0"
            value={form.price_per_lb}
            onChange={(e) => setForm({ ...form, price_per_lb: e.target.value })}
            placeholder={`${t('settings.example')} ${currencySymbol}150`}
          />
          <Input
            label={`${t('settings.minimumPrice')} (${currencySymbol})`}
            type="number"
            step="0.01"
            min="0"
            value={form.minimum_price}
            onChange={(e) => setForm({ ...form, minimum_price: e.target.value })}
            placeholder={`${t('settings.example')} ${currencySymbol}200`}
          />
          <Input
            label={t('settings.itbis')}
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.tax_rate}
            onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
            placeholder="0"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>{t('settings.save')}</Button>
            {saved && <span className="text-green-600 text-sm self-center">✓ {t('settings.saved')}</span>}
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold mb-4">{t('settings.language')}</h2>
        <LanguageSwitcher onLanguageChange={handleLanguageChange} />
      </Card>
    </div>
  );
}
