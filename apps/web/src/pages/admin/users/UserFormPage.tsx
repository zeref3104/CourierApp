import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userService } from '../../../services/user.service';
import { roleService } from '../../../services/role.service';
import { branchService } from '../../../services/branch.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function UserFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', password: '',
    roleId: '', branchId: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    Promise.all([
      roleService.findAll(),
      branchService.findAll({ limit: 100 }),
    ])
      .then(([rolesRes, branchesRes]) => {
        setRoles(rolesRes.data);
        setBranches(branchesRes.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    userService
      .findById(id)
      .then((res) => {
        const u = res.data;
        setForm({
          name: u.name || '',
          lastName: u.lastName || '',
          email: u.email || '',
          password: '',
          roleId: u.roleId?._id || u.roleId || '',
          branchId: u.branchId?._id || u.branchId || '',
        });
      })
      .catch(() => alert('Error al cargar usuario'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await userService.update(id!, {
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          roleId: form.roleId,
          branchId: form.branchId || undefined,
        });
      } else {
        await userService.create({
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          branchId: form.branchId || undefined,
        });
      }
      navigate('/users');
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
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Apellido" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          {!isEdit && (
            <Input
              label="Contraseña"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              placeholder="Mínimo 8 caracteres, mayúscula, minúscula y número"
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rol</label>
              <select
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                required
              >
                <option value="">Seleccionar rol</option>
                {roles.map((r: any) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>

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
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/users')}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
