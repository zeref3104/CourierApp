import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { branchService } from '../../../services/branch.service';
import { userService } from '../../../services/user.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function BranchFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', code: '', address: '', phone: '', email: '',
    isMainBranch: false, managerId: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    userService.findAll({ limit: 100 })
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    branchService.findById(id)
      .then((res) => {
        const b = res.data;
        setForm({
          name: b.name || '',
          code: b.code || '',
          address: b.address || '',
          phone: b.phone || '',
          email: b.email || '',
          isMainBranch: b.isMainBranch || false,
          managerId: b.managerId?._id || b.managerId || '',
        });
      })
      .catch(() => alert('Error al cargar sucursal'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        name: form.name,
        code: form.code,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        isMainBranch: form.isMainBranch,
      };
      if (form.managerId) payload.managerId = form.managerId;

      if (isEdit) {
        await branchService.update(id!, payload);
      } else {
        await branchService.create(payload);
      }
      navigate('/branches');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error');
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
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Editar Sucursal' : 'Nueva Sucursal'}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Código"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              placeholder="Ej: STS"
            />
          </div>
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Encargado</label>
            <select
              value={form.managerId}
              onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="">Sin encargado</option>
              {users.filter((u: any) => u.isActive !== false).map((u: any) => (
                <option key={u._id} value={u._id}>{u.name} {u.lastName}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isMainBranch}
              onChange={(e) => setForm({ ...form, isMainBranch: e.target.checked })}
              className="rounded"
            />
            Sucursal principal
          </label>
          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/branches')}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
