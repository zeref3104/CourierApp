import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { companyService, Plan, Company } from '../../../services/company.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function EditCompanyPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    planId: '',
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      companyService.findById(id),
      companyService.getPlans(),
    ])
      .then(([companyRes, plansRes]) => {
        const company = companyRes.data;
        setForm({
          name: company.name,
          email: company.email,
          phone: company.phone || '',
          planId: company.planId?._id || '',
        });
        setPlans(plansRes.data);
      })
      .catch(() => setError('Error al cargar datos'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.planId) {
      setError('Debes seleccionar un plan');
      return;
    }
    setLoading(true);
    try {
      await companyService.update(id!, {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        planId: form.planId,
      });
      navigate('/companies');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="text-center py-12 text-gray-500">Cargando...</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/companies')}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold">Editar Empresa</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de la empresa"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <Input
            label="Email del administrador"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium mb-1">Plan</label>
            <select
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Seleccionar plan</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.price > 0 ? `- $${p.price}/mes` : '(Gratuito)'}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/companies')}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
