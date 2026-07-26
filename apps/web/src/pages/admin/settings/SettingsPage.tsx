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
    companyName: '', address: '', phone: '', email: '', rnc: '', currency: 'DOP',
    pricePerLb: '', minimumPrice: '', taxRate: '',
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
          companyName: s.companyName || '',
          address: s.address || '',
          phone: s.phone || '',
          email: s.email || '',
          rnc: s.rnc || '',
          currency,
          pricePerLb: s.price_per_lb?.toString() || '',
          minimumPrice: s.minimum_price?.toString() || '',
          taxRate: s.tax_rate?.toString() || '',
        });
      }).catch(() => {});
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { default: api } = await import('../../../config/axios');
      // Map form fields to API key format (camelCase → snake_case for pricing)
      const payload = {
        ...form,
        price_per_lb: form.pricePerLb ? Number(form.pricePerLb) : undefined,
        minimum_price: form.minimumPrice ? Number(form.minimumPrice) : undefined,
        tax_rate: form.taxRate ? Number(form.taxRate) : undefined,
      };
      delete payload.pricePerLb;
      delete payload.minimumPrice;
      delete payload.taxRate;
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
          <Input label="Nombre de la empresa" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
            value={form.pricePerLb}
            onChange={(e) => setForm({ ...form, pricePerLb: e.target.value })}
            placeholder={`Ej: ${currency.symbol}150`}
          />
          <Input
            label={`Precio mínimo (${currency.symbol})`}
            type="number"
            step="0.01"
            min="0"
            value={form.minimumPrice}
            onChange={(e) => setForm({ ...form, minimumPrice: e.target.value })}
            placeholder={`Ej: ${currency.symbol}200`}
          />
          <Input
            label="ITBIS (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
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