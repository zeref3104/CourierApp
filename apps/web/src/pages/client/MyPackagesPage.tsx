import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';

export default function MyPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    // Client packages will be loaded via /client/packages endpoint
    import('../../config/axios').then(({ default: api }) => {
      api.get('/client/packages').then((r) => setPackages(r.data.data || []));
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mis Paquetes</h1>
      <Card padding={false}>
        <Table headers={['Tracking', 'Descripción', 'Peso', 'Estado', 'Fecha']}>
          {packages.map((p: any) => (
            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-mono font-medium">{p.tracking}</td>
              <td className="px-4 py-3">{p.description}</td>
              <td className="px-4 py-3">{p.weight} lbs</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </Table>
        {packages.length === 0 && (
          <p className="text-center py-8 text-gray-400">No tienes paquetes registrados</p>
        )}
      </Card>
    </div>
  );
}