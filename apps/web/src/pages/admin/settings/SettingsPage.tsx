import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

const CURRENCY_INFO: Record<string, { symbol: string; name: string }> = {
  DOP: { symbol: 'RD$', name: 'Peso dominicano' },
  USD: { symbol: 'US$', name: 'Dólar' },
  EUR: { symbol: '€', name: 'Euro' },
};

export default function SettingsPage() {
  const [form, setForm] = useState({
    company_name: '', company_address: '', company_phone: '', company_email: '', rnc: '', currency: 'DOP',
    price_per_lb: '', minimum_price: '', tax_rate: '',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const currency = CURRENCY_INFO[form.currency] || { symbol: form.currency, name: form.currency };

  useEffect(() => {
    import('../../../config/axios').then(({ default: api }) => {
      api.get('/settings').then((r) => {
        const s = r.data.data || {};
        const currency = s.currency || 'DOP';
        localStorage.setItem('currency', currency);
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
      alert(err.response?.data?.error?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la empresa" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input label="Dirección" value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} />
          <Input label="Teléfono" value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
          <Input label="Email" type="email" value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} />
          <Input label="RNC" value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })} placeholder="101-00000-0" />
          <div>
            <label className="block text-sm font-medium mb-1">Moneda</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {Object.entries(CURRENCY_INFO).map(([code, info]) => (
                <option key={code} value={code}>{code} ({info.symbol}) - {info.name}</option>
              ))}
            </select>
          </div>
          <hr className="my-6 border-gray-200 dark:border-gray-700" />
          <h2 className="text-lg font-semibold mb-4">Precios y tasas</h2>

          <Input
            label={`Precio por libra (${currency.symbol})`}
            type="number"
            step="0.01"
            min="0"
            value={form.price_per_lb}
            onChange={(e) => setForm({ ...form, price_per_lb: e.target.value })}
            placeholder={`Ej: ${currency.symbol}150`}
          />
          <Input
            label={`Precio mínimo (${currency.symbol})`}
            type="number"
            step="0.01"
            min="0"
            value={form.minimum_price}
            onChange={(e) => setForm({ ...form, minimum_price: e.target.value })}
            placeholder={`Ej: ${currency.symbol}200`}
          />
          <Input
            label="ITBIS (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.tax_rate}
            onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
            placeholder="18"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            {saved && <span className="text-green-600 text-sm self-center">✓ Guardado</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
