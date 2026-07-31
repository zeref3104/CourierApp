import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../../services/dashboard.service';
import { StatCard } from '../../components/ui/Card';
import { Card } from '../../components/ui/Card';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatRelative } from '../../utils/formatDate';

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await dashboardService.getSummary();
      setSummary(r.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);
  useLiveRefresh('socket:payments-changed', load);
  useLiveRefresh('socket:deliveries-changed', load);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
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
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes registrados" value={summary?.totalCustomers || 0} icon="👥" />
        <StatCard label="Recibidos hoy" value={summary?.packagesReceivedToday || 0} icon="📥" />
        <StatCard label="En tránsito" value={summary?.inTransit || 0} icon="✈️" />
        <StatCard label="Disponibles" value={summary?.packagesReady || 0} icon="📦" />
        <StatCard label="Entregados hoy" value={summary?.deliveredToday || 0} icon="✅" />
        <StatCard label="Ingresos hoy" value={formatCurrency(summary?.revenueToday || 0)} icon="💰" />
        <StatCard
          label="Cobros pendientes"
          value={formatCurrency(summary?.pendingPayments?.amount || 0)}
          icon="⏳"
        />
      </div>

      {/* Recent activity */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Últimos movimientos</h2>
        <div className="space-y-3">
          {summary?.recentActivity?.length > 0 ? (
            summary.recentActivity.map((activity: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div>
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.userId?.name || 'Sistema'}</p>
                </div>
                <span className="text-xs text-gray-400">{formatRelative(activity.createdAt)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">Sin actividad reciente</p>
          )}
        </div>
      </Card>
    </div>
  );
}