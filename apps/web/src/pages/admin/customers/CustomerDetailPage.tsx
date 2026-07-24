import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customerService } from '../../../services/customer.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatDate } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    customerService.findById(id).then((r) => setCustomer(r.data));
    customerService.getPackages(id).then((r) => setPackages(r.data));
  }, [id]);

  if (!customer) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{customer.name} {customer.lastName}</h1>
        <Link to={`/customers/${id}/edit`} className="text-sm text-primary-600 hover:text-primary-700">Editar</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><p className="text-sm text-gray-500">Código</p><p className="text-lg font-semibold">{customer.code}</p></Card>
        <Card><p className="text-sm text-gray-500">Teléfono</p><p className="text-lg font-semibold">{customer.phone}</p></Card>
        <Card><p className="text-sm text-gray-500">Paquetes</p><p className="text-lg font-semibold">{customer.totalPackages || 0}</p></Card>
        <Card><p className="text-sm text-gray-500">Total pagado</p><p className="text-lg font-semibold">{formatCurrency(customer.totalPaid || 0)}</p></Card>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Documento:</span> {customer.document || '—'}</div>
          <div><span className="text-gray-500">Email:</span> {customer.email || '—'}</div>
          <div><span className="text-gray-500">Dirección:</span> {customer.address || '—'}</div>
          <div><span className="text-gray-500">Dirección Miami:</span> {customer.miamiAddress || '—'}</div>
          <div><span className="text-gray-500">Sucursal:</span> {customer.branchId?.name || '—'}</div>
          <div><span className="text-gray-500">Creado:</span> {formatDate(customer.createdAt)}</div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Paquetes</h2>
        <Table headers={['Tracking', 'Descripción', 'Peso', 'Estado', 'Total', 'Fecha']}>
          {packages.map((p: any) => (
            <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-3 font-mono text-sm"><Link to={`/packages/${p._id}`} className="text-primary-600">{p.tracking}</Link></td>
              <td className="px-4 py-3">{p.description}</td>
              <td className="px-4 py-3">{p.weight} lbs</td>
              <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-3">{formatCurrency(p.total)}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}