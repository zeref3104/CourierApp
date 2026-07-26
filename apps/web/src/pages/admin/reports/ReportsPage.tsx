import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatCurrency';
import { Badge } from '../../../components/ui/Badge';
import { paymentService } from '../../../services/payment.service';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

const METHOD_ICONS: Record<string, string> = {
  cash: '💵',
  card: '💳',
  transfer: '🏦',
};

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReportsPage() {
  const [date, setDate] = useState(todayLocal);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentService.getDailySummary(date);
      setSummary(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Error al cargar reportes');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);

  const totalByMethod = summary?.byMethod
    ? Object.values(summary.byMethod).reduce((s: number, v: any) => s + (v || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      <div className="flex items-center gap-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
        <Button onClick={load} loading={loading}>Actualizar</Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total cobrado</p>
          <p className="text-2xl font-bold">{formatCurrency(summary?.totalCollected || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Transacciones</p>
          <p className="text-2xl font-bold">{summary?.transactionCount || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
          <p className="text-2xl font-bold">{summary?.pendingCount || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Promedio por transacción</p>
          <p className="text-2xl font-bold">
            {summary?.transactionCount
              ? formatCurrency(summary.totalCollected / summary.transactionCount)
              : formatCurrency(0)}
          </p>
        </Card>
      </div>

      {summary?.byMethod && (
        <Card>
          <h2 className="font-semibold mb-4">Por método de pago</h2>
          <div className="space-y-3">
            {Object.entries(summary.byMethod).map(([method, total]: [string, any]) => (
              <div key={method} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>{METHOD_ICONS[method] || '💳'}</span>
                  <span className="font-medium">{METHOD_LABELS[method] || method}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{formatCurrency(total || 0)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {totalByMethod ? Math.round(((total || 0) / totalByMethod) * 100) : 0}% del total
                  </p>
                </div>
              </div>
            ))}
          </div>
          {summary.pendingCount > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <Badge variant="warning">{summary.pendingCount} pendiente{summary.pendingCount !== 1 ? 's' : ''}</Badge>
                {' '}con estado pendiente de cobro
              </p>
            </div>
          )}
        </Card>
      )}

      {summary === null && !loading && !error && (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos para esta fecha.</p>
        </Card>
      )}
    </div>
  );
}
