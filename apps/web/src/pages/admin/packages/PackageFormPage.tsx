import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { packageService } from '../../../services/package.service';
import { branchService } from '../../../services/branch.service';
import { RootState } from '../../../store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import CustomerSearchInput from '../../../components/ui/CustomerSearchInput';

export default function PackageFormPage() {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  // Users with a fixed branch rely on the server-side branchId injection.
  // Users without one (e.g. admins) pick a branch explicitly.
  const showBranchSelect = !user?.branchId;
  const [branches, setBranches] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: '', carrierTracking: '', description: '', weight: '',
    declaredValue: '', notes: '', branchId: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showBranchSelect) {
      branchService.findAll({ limit: 100 }).then((r) => setBranches(r.data)).catch(() => {});
    }
  }, [showBranchSelect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) return;
    setLoading(true);
    try {
      const res = await packageService.create({
        ...form,
        branchId: form.branchId || undefined,
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
          <CustomerSearchInput
            value={form.customerId}
            onChange={(customerId) => setForm({ ...form, customerId })}
          />
          {showBranchSelect && (
            <div>
              <label className="block text-sm font-medium mb-1">Sucursal</label>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar sucursal</option>
                {branches.filter((b: any) => b.isActive !== false).map((b: any) => (
                  <option key={b._id} value={b._id}>{b.name} - {b.code}</option>
                ))}
              </select>
            </div>
          )}
          <Input label="Tracking del carrier (UPS/FedEx)" value={form.carrierTracking} onChange={(e) => setForm({ ...form, carrierTracking: e.target.value })} placeholder="Opcional — 1Z999AA10123456784" />
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