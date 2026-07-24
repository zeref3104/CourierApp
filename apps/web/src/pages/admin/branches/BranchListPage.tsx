import { useState, useEffect } from 'react';
import { branchService } from '../../../services/branch.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';

export default function BranchListPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await branchService.findAll({ page, limit: 20, search: debouncedSearch });
      setBranches(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sucursales</h1>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, código o dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="🔍"
        />
      </div>

      <Card padding={false}>
        <Table
          headers={['Nombre', 'Código', 'Dirección', 'Teléfono', 'Estado']}
          loading={loading}
        >
          {branches.map((b) => (
            <tr key={b._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-medium">{b.name}</td>
              <td className="px-4 py-3 font-mono text-sm">{b.code}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{b.address || '—'}</td>
              <td className="px-4 py-3">{b.phone || '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={b.isActive !== false ? 'success' : 'danger'}>
                  {b.isActive !== false ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
