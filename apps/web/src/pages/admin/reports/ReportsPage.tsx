import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatCurrency';

export default function ReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { paymentService } = await import('../../../services/payment.service');
      const res = await paymentService.getDailySummary(date);
      setSummary(res.data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, [date]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total cobrado</p>
          <p className="text-2xl font-bold">{formatCurrency(summary?.totalAmount || 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="text-2xl font-bold">{summary?.count || 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Promedio</p>
          <p className="text-2xl font-bold">{formatCurrency(summary?.average || 0)}</p>
        </Card>
      </div>

      {summary?.byMethod && (
        <Card>
          <h2 className="font-semibold mb-4">Por método de pago</h2>
          <div className="space-y-3">
            {Object.entries(summary.byMethod).map(([method, data]: any) => (
              <div key={method} className="flex justify-between items-center">
                <span className="capitalize">{method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : 'Transferencia'}</span>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(data.total)}</p>
                  <p className="text-sm text-gray-500">{data.count} transacciones</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}