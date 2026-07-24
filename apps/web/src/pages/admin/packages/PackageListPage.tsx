import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { packageService } from '../../../services/package.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Input } from '../../../components/ui/Input';
import { StatusBadge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDate, formatRelative } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

export default function PackageListPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, search: debouncedSearch };
      if (statusFilter) params.status = statusFilter;
      const res = await packageService.findAll(params);
      setPackages(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paquetes</h1>
        <Link to="/packages/new">
          <button className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
            Nuevo Paquete
          </button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por tracking o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔍"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="recibido_miami">Recibido Miami</option>
          <option value="en_transito">En Tránsito</option>
          <option value="disponible">Disponible</option>
          <option value="entregado">Entregado</option>
        </select>
      </div>

      <Card padding={false}>
        <Table
          headers={['Tracking', 'Cliente', 'Peso', 'Total', 'Estado', 'Creado', 'Acciones']}
          loading={loading}
        >
          {packages.map((p) => (
            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-mono text-sm font-medium">{p.tracking}</td>
              <td className="px-4 py-3">{p.customerId?.name} {p.customerId?.lastName}</td>
              <td className="px-4 py-3">{p.weight} lbs</td>
              <td className="px-4 py-3">{formatCurrency(p.total)}</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-3 text-gray-500 text-xs">{formatRelative(p.createdAt)}</td>
              <td className="px-4 py-3">
                <Link to={`/packages/${p._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}