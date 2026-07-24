import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userService } from '../../../services/user.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  courier: 'Courier',
  office: 'Oficina',
};

const ROLES = [
  { value: '', label: 'Todos los roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Gerente' },
  { value: 'courier', label: 'Courier' },
  { value: 'office', label: 'Oficina' },
];

export default function UserListPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, search: debouncedSearch };
      if (roleFilter) params.role = roleFilter;
      const res = await userService.findAll(params);
      setUsers(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch, roleFilter]);

  const handleToggleStatus = async (id: string) => {
    try {
      await userService.toggleStatus(id);
      load(meta.page);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error al cambiar estado');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Link to="/users/new">
          <Button>Nuevo Usuario</Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔍"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <Card padding={false}>
        <Table
          headers={['Email', 'Nombre', 'Rol', 'Sucursal', 'Estado', 'Acciones']}
          loading={loading}
        >
          {users.map((u) => (
            <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 text-sm">{u.email}</td>
              <td className="px-4 py-3">{u.name} {u.lastName}</td>
              <td className="px-4 py-3">
                <Badge>{ROLE_LABELS[u.role] || u.role}</Badge>
              </td>
              <td className="px-4 py-3 text-sm">{u.branchId?.name || '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={u.isActive !== false ? 'success' : 'danger'}>
                  {u.isActive !== false ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Link to={`/users/${u._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                    Editar
                  </Link>
                  <button
                    onClick={() => handleToggleStatus(u._id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    {u.isActive !== false ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
