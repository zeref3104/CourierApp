import { useState, useEffect, useCallback } from 'react';
import { clientService } from '../../services/client.service';
import { Card, StatCard } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatRelative } from '../../utils/formatDate';

export default function ClientDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await clientService.getDashboard();
      setData(r.data);
      setError('');
    } catch {
      setError('No se pudieron cargar tus paquetes. Intenta de nuevo más tarde.');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Paquetes</h1>
      <p className="text-gray-500">Bienvenido a tu panel de seguimiento</p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="En tránsito" value={data?.inTransit || 0} />
            <StatCard label="Disponibles" value={data?.readyForPickup || 0} />
            <StatCard label="Entregados" value={data?.delivered || 0} />
            <StatCard label="Totales" value={data?.totalPackages || 0} />
          </div>

          <Card>
            <h2 className="text-lg font-semibold mb-4">Últimos paquetes</h2>
            {data?.lastTracking?.length > 0 ? (
              <div className="space-y-3">
                {data.lastTracking.map((p: any) => (
                  <div key={p.tracking} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium font-mono">{p.tracking}</p>
                      <p className="text-xs text-gray-500">{formatRelative(p.createdAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Los datos de tu dashboard aparecerán cuando tengas paquetes registrados.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
