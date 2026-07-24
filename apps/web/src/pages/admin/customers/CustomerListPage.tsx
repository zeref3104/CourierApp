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
          loading={loading}
        >
          {customers.map((c) => (
            <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-medium">{c.code}</td>
              <td className="px-4 py-3">{c.name} {c.lastName}</td>
              <td className="px-4 py-3 text-gray-500">{c.document || '—'}</td>
              <td className="px-4 py-3">{c.phone}</td>
              <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
              <td className="px-4 py-3">
                <Link to={`/customers/${c._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={load}
      />
    </div>
  );
}