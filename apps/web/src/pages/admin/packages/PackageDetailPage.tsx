import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { packageService } from '../../../services/package.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatDate, formatDateTime } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';
import { printPackageLabel } from '../../../utils/packageLabel';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  recibido_miami: ['almacen_miami'],
  almacen_miami: ['en_transito'],
  en_transito: ['llego_rd'],
  llego_rd: ['almacen_rd'],
  almacen_rd: ['disponible', 'cancelado', 'extraviado'],
  disponible: ['en_reparto', 'entregado', 'cancelado'],
  en_reparto: ['entregado', 'disponible'],
};

export default function PackageDetailPage() {
  const { id } = useParams();
  const [pkg, setPkg] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      packageService.findById(id),
      packageService.getHistory(id),
    ]).then(([pkgRes, historyRes]) => {
      setPkg(pkgRes.data);
      setHistory(historyRes.data);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!pkg) return <div className="text-center py-12 text-gray-400">Paquete no encontrado</div>;

  const nextStatuses = STATUS_TRANSITIONS[pkg.status] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paquete {pkg.tracking}</h1>
        <Button onClick={() => printPackageLabel(pkg)}>Imprimir etiqueta</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-medium">{pkg.customerId?.name} {pkg.customerId?.lastName}</p>
              <p className="text-sm text-gray-500">{pkg.customerId?.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <StatusBadge status={pkg.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Descripción</p>
              <p className="font-medium">{pkg.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sucursal</p>
              <p className="font-medium">{pkg.branchId?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Peso</p>
              <p className="font-medium">{pkg.weight} lbs</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor declarado</p>
              <p className="font-medium">{formatCurrency(pkg.declaredValue, 'USD')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Recibido</p>
              <p className="font-medium">{formatDateTime(pkg.receivedAt)}</p>
            </div>
            {pkg.deliveredAt && (
              <div>
                <p className="text-sm text-gray-500">Entregado</p>
                <p className="font-medium">{formatDateTime(pkg.deliveredAt)}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Cost breakdown */}
        <Card>
          <h3 className="font-semibold mb-4">Costos</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Costo base</span>
              <span>{formatCurrency(pkg.cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Impuesto</span>
              <span>{formatCurrency(pkg.tax)}</span>
            </div>
            <hr className="dark:border-gray-700" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatCurrency(pkg.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pagado</span>
              <span className={pkg.isPaid ? 'text-green-600' : 'text-red-600'}>
                {pkg.isPaid ? 'Sí' : 'No'}
              </span>
            </div>
          </div>

          {/* Status transitions */}
          {nextStatuses.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Cambiar estado</h3>
              <div className="space-y-2">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      await packageService.changeStatus(id!, s);
                      window.location.reload();
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Historial de estados</h2>
        <div className="space-y-3">
          {history.map((h: any) => (
            <div key={h._id} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">
                    {h.fromStatus ? `${h.fromStatus.replace(/_/g, ' ')} → ${h.toStatus.replace(/_/g, ' ')}` : h.toStatus.replace(/_/g, ' ')}
                  </p>
                  <span className="text-xs text-gray-400">{formatDateTime(h.createdAt)}</span>
                </div>
                {h.changedBy && <p className="text-xs text-gray-500">Por: {h.changedBy.name}</p>}
                {h.notes && <p className="text-xs text-gray-500 mt-1">{h.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}