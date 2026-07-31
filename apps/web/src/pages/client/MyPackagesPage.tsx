import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';

export default function MyPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);

  const load = useCallback(async () => {
    const api = (await import('../../config/axios')).default;
    api.get('/client/packages').then((r) => setPackages(r.data.data || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mis Paquetes</h1>
      <Card padding={false}>
        <Table
          headers={['Tracking', 'Descripción', 'Peso', 'Estado', 'Fecha']}
          items={packages}
          renderRow={(p) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tracking</span>
                <span className="font-mono font-medium">{p.tracking}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Descripción</span>
                <span>{p.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Peso</span>
                <span>{p.weight} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Estado</span>
                <span><StatusBadge status={p.status} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Fecha</span>
                <span className="text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        />
        {packages.length === 0 && (
          <p className="text-center py-8 text-gray-400">No tienes paquetes registrados</p>
        )}
      </Card>
    </div>
  );
}