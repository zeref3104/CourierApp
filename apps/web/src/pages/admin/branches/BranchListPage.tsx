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
          items={branches}
          loading={loading}
          renderRow={(b) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Nombre</span>
                <span className="font-medium">{b.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Código</span>
                <span className="font-mono text-sm">{b.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Dirección</span>
                <span className="text-sm text-gray-500">{b.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Teléfono</span>
                <span>{b.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Estado</span>
                <span><Badge variant={b.isActive !== false ? 'success' : 'danger'}>{b.isActive !== false ? 'Activo' : 'Inactivo'}</Badge></span>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
