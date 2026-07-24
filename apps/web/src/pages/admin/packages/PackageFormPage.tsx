import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { packageService } from '../../../services/package.service';
import { customerService } from '../../../services/customer.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function PackageFormPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: '', description: '', weight: '',
    declaredValue: '', notes: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    customerService.findAll({ limit: 100 }).then((r) => setCustomers(r.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await packageService.create({
        ...form,
        weight: Number(form.weight),
        declaredValue: Number(form.declaredValue) || 0,
      });
      navigate(`/packages/${res.data._id}`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Nuevo Paquete</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              required
            >
              <option value="">Seleccionar cliente</option>
              {customers.map((c: any) => (
                <option key={c._id} value={c._id}>{c.code} - {c.name} {c.lastName}</option>
              ))}
            </select>
          </div>
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <Input label="Peso (lbs)" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required />
          <Input label="Valor declarado (USD)" type="number" value={form.declaredValue} onChange={(e) => setForm({ ...form, declaredValue: e.target.value })} />
          <Input label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/packages')}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}