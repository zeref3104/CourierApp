import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ClientPackageDetail } from '../../types/package';

export default function ClientPackageDetailPage() {
  const { tracking } = useParams();
  const { t } = useTranslation();
  const [pkg, setPkg] = useState<ClientPackageDetail | null>(null);

  const load = useCallback(async () => {
    if (!tracking) return;
    const api = (await import('../../config/axios')).default;
    api.get(`/client/packages/${tracking}`).then((r) => setPkg(r.data.data));
  }, [tracking]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  if (!pkg) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;

  // Amount-to-pay disclosure mirrors the API contract (and the mobile app):
  // the section renders ONLY when the package is `disponible` and the backend
  // actually disclosed an amount. Any other status shows NO price section.
  const showAmountSection = pkg.status === 'disponible' && typeof pkg.amountToPay === 'number';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('packages.titleWithTracking', { tracking: pkg.tracking })}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500">{t('common.status')}</p>
          <StatusBadge status={pkg.status} />
          <p className="text-sm text-gray-500 mt-4">{t('packages.description')}</p>
          <p>{pkg.description}</p>
          <p className="text-sm text-gray-500 mt-4">{t('packages.weight')}</p>
          <p>{pkg.weight} lbs</p>
        </Card>
        {showAmountSection && (
          <Card>
            <p className="text-sm text-gray-500">{t('client.amountToPay')}</p>
            <p className="text-xl font-bold">{formatCurrency(pkg.amountToPay as number, pkg.currency)}</p>
            {pkg.pickupBranch && (
              <>
                <p className="text-sm text-gray-500 mt-4">{t('client.pickupBranch')}</p>
                <p>{pkg.pickupBranch.name}</p>
                {pkg.pickupBranch.address && (
                  <p className="text-sm text-gray-500">{pkg.pickupBranch.address}</p>
                )}
              </>
            )}
            <p className="text-sm text-gray-500 mt-4">{t('client.payAtPickup')}</p>
          </Card>
        )}
      </div>

      {pkg.history && (
        <Card>
          <h2 className="font-semibold mb-4">{t('client.history')}</h2>
          <div className="space-y-3">
            {pkg.history.map((h: any) => (
              <div key={h._id} className="flex gap-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">{t(`status.${h.toStatus}`, { defaultValue: h.toStatus })}</p>
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
