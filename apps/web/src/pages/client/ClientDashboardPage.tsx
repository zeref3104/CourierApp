import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboard.service';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatCurrency';

export default function ClientDashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    import('../../services/package.service').then(({ packageService }) => {
      packageService.findAll({ customerId: 'me', limit: 5 }).then((r) => setData(r.data));
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis Paquetes</h1>
      <p className="text-gray-500">Bienvenido a tu panel de seguimiento</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><p className="text-sm text-gray-500">En tránsito</p><p className="text-2xl font-bold">—</p></Card>
        <Card><p className="text-sm text-gray-500">Disponibles</p><p className="text-2xl font-bold">—</p></Card>
        <Card><p className="text-sm text-gray-500">Entregados</p><p className="text-2xl font-bold">—</p></Card>
        <Card><p className="text-sm text-gray-500">Totales</p><p className="text-2xl font-bold">—</p></Card>
      </div>

      <Card>
        <p className="text-sm text-gray-400 text-center py-8">
          Los datos de tu dashboard aparecerán cuando tengas paquetes registrados.
        </p>
      </Card>
    </div>
  );
}