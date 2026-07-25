import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function SettingsPage() {
  const [form, setForm] = useState({
    companyName: '', address: '', phone: '', email: '', rnc: '', currency: 'DOP',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    import('../../../config/axios').then(({ default: api }) => {
      api.get('/settings').then((r) => {
        const s = r.data.data || {};
        setForm({
          companyName: s.companyName || '',
          address: s.address || '',
          phone: s.phone || '',
          email: s.email || '',
          rnc: s.rnc || '',
          currency: s.currency || 'DOP',
        });
      }).catch(() => {});
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { default: api } = await import('../../../config/axios');
      await api.patch('/settings', form);
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
              <option value="DOP">DOP - Peso dominicano</option>
              <option value="USD">USD - Dólar</option>
              <option value="EUR">EUR - Euro</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            {saved && <span className="text-green-600 text-sm self-center">✓ Guardado</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}