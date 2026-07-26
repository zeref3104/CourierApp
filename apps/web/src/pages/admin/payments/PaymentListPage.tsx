import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { paymentService } from '../../../services/payment.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDate } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

export default function PaymentListPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await paymentService.findAll({ page, limit: 20, search: debouncedSearch });
      setPayments(res.data);
      if (res.meta) setMeta(res.meta);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <Link to="/payments/new">
          <Button>Nuevo Pago</Button>
        </Link>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Buscar por recibo o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="🔍"
        />
      </div>

      <Card padding={false}>
        <Table
          headers={['Recibo', 'Cliente', 'Paquetes', 'Monto', 'Método', 'Estado', 'Fecha', '']}
          items={payments}
          loading={loading}
          renderRow={(p) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Recibo</span>
                <span className="font-medium">{p.receiptNumber || p._id.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Cliente</span>
                <span>{p.customerId?.name} {p.customerId?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Paquetes</span>
                <span className="text-right">
                  {p.packages?.map((pkg: any) => pkg.tracking || pkg).join(', ') || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Monto</span>
                <span>{formatCurrency(p.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Método</span>
                <span><Badge>{METHOD_LABELS[p.method] || p.method}</Badge></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Estado</span>
                <span><Badge variant={p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'default'}>
                  {p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : p.status}
                </Badge></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Fecha</span>
                <span className="text-gray-500 text-sm">{formatDate(p.createdAt)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <Link to={`/payments/${p._id}`} className="text-primary-600 hover:text-primary-700 text-sm block text-right">
                  Ver detalles
                </Link>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
