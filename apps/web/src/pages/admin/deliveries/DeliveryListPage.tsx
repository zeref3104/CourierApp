import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { deliveryService } from '../../../services/delivery.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Input } from '../../../components/ui/Input';
import { StatusBadge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDate } from '../../../utils/formatDate';

const DELIVERY_STATUSES = [
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_curso', label: 'En Curso' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'fallido', label: 'Fallido' },
];

export default function DeliveryListPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
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
      const res = await deliveryService.findAll(params);
      setDeliveries(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entregas</h1>
      </div>

      <div className="flex gap-4">
        <div className="max-w-sm flex-1">
          <Input
            placeholder="Buscar por tracking o dirección..."
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
          {DELIVERY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <Card padding={false}>
        <Table
          headers={['Tracking', 'Cliente', 'Dirección', 'Courier', 'Estado', 'Fecha', 'Acciones']}
          items={deliveries}
          loading={loading}
          renderRow={(d) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tracking</span>
                <span className="font-mono text-sm font-medium">{d.tracking || d.packageId?.tracking}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Cliente</span>
                <span>{d.customerId?.name} {d.customerId?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Dirección</span>
                <span className="text-sm">{d.address || d.packageId?.customerId?.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Courier</span>
                <span>{d.courierId?.name || d.assignedTo?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Estado</span>
                <span><StatusBadge status={d.status} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Fecha</span>
                <span className="text-gray-500 text-sm">{formatDate(d.createdAt)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <Link to={`/packages/${d.packageId?._id || d._id}`} className="text-primary-600 hover:text-primary-700 text-sm block text-right">
                  Ver paquete
                </Link>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
