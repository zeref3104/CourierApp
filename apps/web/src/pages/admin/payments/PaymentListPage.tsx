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
          headers={['Recibo#', 'Cliente', 'Monto', 'Método', 'Estado', 'Fecha', 'Acciones']}
          loading={loading}
        >
          {payments.map((p) => (
            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-medium">{p.receiptNumber || p._id.slice(-6)}</td>
              <td className="px-4 py-3">{p.customerId?.name} {p.customerId?.lastName}</td>
              <td className="px-4 py-3">{formatCurrency(p.amount)}</td>
              <td className="px-4 py-3">
                <Badge>{METHOD_LABELS[p.method] || p.method}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={p.status === 'completed' ? 'success' : p.status === 'pending' ? 'warning' : 'default'}>
                  {p.status === 'completed' ? 'Completado' : p.status === 'pending' ? 'Pendiente' : p.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm">{formatDate(p.createdAt)}</td>
              <td className="px-4 py-3">
                <Link to={`/payments/${p._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
