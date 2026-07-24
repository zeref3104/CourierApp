import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatDate } from '../../../utils/formatDate';

export default function ClientPackageDetailPage() {
  const { tracking } = useParams();
  const [pkg, setPkg] = useState<any>(null);

  useEffect(() => {
    if (!tracking) return;
    import('../../../config/axios').then(({ default: api }) => {
      api.get(`/client/packages/${tracking}`).then((r) => setPkg(r.data.data));
    });
  }, [tracking]);

  if (!pkg) return <div className="text-center py-12 text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Paquete {pkg.tracking}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Estado</p>
          <StatusBadge status={pkg.status} />
          <p className="text-sm text-gray-500 mt-4">Descripción</p>
          <p>{pkg.description}</p>
          <p className="text-sm text-gray-500 mt-4">Peso</p>
          <p>{pkg.weight} lbs</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Costo base</p>
          <p>${pkg.cost?.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-4">Impuesto</p>
          <p>${pkg.tax?.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-4 font-semibold">Total</p>
          <p className="text-xl font-bold">${pkg.total?.toFixed(2)}</p>
        </Card>
      </div>

      {pkg.history && (
        <Card>
          <h2 className="font-semibold mb-4">Historial</h2>
          <div className="space-y-3">
            {pkg.history.map((h: any) => (
              <div key={h._id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">{h.toStatus?.replace(/_/g, ' ')}</p>
                  <p className="text-gray-500 text-xs">{formatDate(h.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}