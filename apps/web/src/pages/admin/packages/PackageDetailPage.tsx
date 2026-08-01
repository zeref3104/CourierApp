import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { packageService } from '../../../services/package.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatDate, formatDateTime } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';
import { printPackageLabel } from '../../../utils/packageLabel';
import { useLiveRefresh } from '../../../hooks/useSocketEvents';
import { STATUS_TRANSITIONS } from '@courier/constants';

export default function PackageDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
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

  useLiveRefresh('socket:packages-changed', () => {
    if (!id) return;
    Promise.all([
      packageService.findById(id),
      packageService.getHistory(id),
    ]).then(([pkgRes, historyRes]) => {
      setPkg(pkgRes.data);
      setHistory(historyRes.data);
    }).catch(() => {});
  });

  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;
  if (!pkg) return <div className="text-center py-12 text-gray-400">{t('packages.notFound')}</div>;

  const nextStatuses = STATUS_TRANSITIONS[pkg.status] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('packages.titleWithTracking', { tracking: pkg.tracking })}</h1>
        <Button onClick={() => printPackageLabel(pkg)}>{t('packages.printLabel')}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">{t('common.customer')}</p>
              <p className="font-medium">{pkg.customerId?.name} {pkg.customerId?.lastName}</p>
              <p className="text-sm text-gray-500">{pkg.customerId?.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('common.status')}</p>
              <StatusBadge status={pkg.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('packages.description')}</p>
              <p className="font-medium">{pkg.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('common.branch')}</p>
              <p className="font-medium">{pkg.branchId?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('packages.weight')}</p>
              <p className="font-medium">{pkg.weight} lbs</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('packages.declaredValue')}</p>
              <p className="font-medium">{formatCurrency(pkg.declaredValue, 'USD')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('packages.received')}</p>
              <p className="font-medium">{formatDateTime(pkg.receivedAt)}</p>
            </div>
            {pkg.deliveredAt && (
              <div>
                <p className="text-sm text-gray-500">{t('packages.delivered')}</p>
                <p className="font-medium">{formatDateTime(pkg.deliveredAt)}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Cost breakdown */}
        <Card>
          <h3 className="font-semibold mb-4">{t('packages.costs')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('packages.baseCost')}</span>
              <span>{formatCurrency(pkg.cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('packages.tax')}</span>
              <span>{formatCurrency(pkg.tax)}</span>
            </div>
            <hr className="dark:border-gray-700" />
            <div className="flex justify-between font-semibold text-base">
              <span>{t('packages.total')}</span>
              <span>{formatCurrency(pkg.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('packages.paid')}</span>
              <span className={pkg.isPaid ? 'text-green-600' : 'text-red-600'}>
                {pkg.isPaid ? t('common.yes') : t('common.no')}
              </span>
            </div>
          </div>

          {/* Status transitions */}
          {nextStatuses.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">{t('packages.changeStatus')}</h3>
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
                    {t(`status.${s}`, { defaultValue: s })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">{t('packages.statusHistory')}</h2>
        <div className="space-y-3">
          {history.map((h: any) => (
            <div key={h._id} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">
                    {h.fromStatus
                      ? t('packages.statusTransition', {
                          from: t(`status.${h.fromStatus}`, { defaultValue: h.fromStatus }),
                          to: t(`status.${h.toStatus}`, { defaultValue: h.toStatus }),
                        })
                      : t(`status.${h.toStatus}`, { defaultValue: h.toStatus })}
                  </p>
                  <span className="text-xs text-gray-400">{formatDateTime(h.createdAt)}</span>
                </div>
                {h.changedBy && <p className="text-xs text-gray-500">{t('packages.changedBy', { name: h.changedBy.name })}</p>}
                {h.notes && <p className="text-xs text-gray-500 mt-1">{h.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
