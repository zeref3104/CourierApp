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
          items={users}
          loading={loading}
          renderRow={(u) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Email</span>
                <span className="text-sm">{u.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Nombre</span>
                <span>{u.name} {u.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Rol</span>
                <span><Badge>{ROLE_LABELS[u.role] || u.role}</Badge></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Sucursal</span>
                <span className="text-sm">{u.branchId?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Estado</span>
                <span><Badge variant={u.isActive !== false ? 'success' : 'danger'}>{u.isActive !== false ? 'Activo' : 'Inactivo'}</Badge></span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2 justify-end">
                <Link to={`/users/${u._id}`} className="text-primary-600 hover:text-primary-700 text-sm">Editar</Link>
                <button onClick={() => handleToggleStatus(u._id)} className="text-red-600 hover:text-red-700 text-sm">
                  {u.isActive !== false ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
