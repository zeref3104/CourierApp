import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { customerService } from '../../../services/customer.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDate } from '../../../utils/formatDate';

export default function CustomerListPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await customerService.findAll({ page, limit: 20, search: debouncedSearch });
      setCustomers(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link to="/customers/new">
          <Button>Nuevo Cliente</Button>
        </Link>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, documento o código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="🔍"
        />
      </div>

      <Card padding={false}>
        <Table
          headers={['Código', 'Nombre', 'Documento', 'Teléfono', 'Creado', 'Acciones']}
          items={customers}
          loading={loading}
          renderRow={(c) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Código</span>
                <span className="font-medium">{c.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Nombre</span>
                <span>{c.name} {c.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Documento</span>
                <span className="text-gray-500">{c.document || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Teléfono</span>
                <span>{c.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Creado</span>
                <span className="text-gray-500">{formatDate(c.createdAt)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <Link to={`/customers/${c._id}`} className="text-primary-600 hover:text-primary-700 text-sm block text-right">
                  Ver detalles
                </Link>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={load}
      />
    </div>
  );
}