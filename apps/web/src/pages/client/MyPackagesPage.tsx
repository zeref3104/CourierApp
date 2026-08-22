import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';

export default function MyPackagesPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<any[]>([]);

  const load = useCallback(async () => {
    const api = (await import('../../config/axios')).default;
    api.get('/client/packages').then((r) => setPackages(r.data.data || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.myPackages')}</h1>
      <Card padding={false}>
        <Table
          headers={[t('packages.tracking'), t('packages.description'), t('packages.weight'), t('common.status'), t('common.date')]}
          items={packages}
          renderRow={(p) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.tracking')}</span>
                <span className="font-mono font-medium">{p.tracking}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.description')}</span>
                <span>{p.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.weight')}</span>
                <span>{p.weight} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.status')}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {p.status === 'disponible' && p.amountToPay != null && (
                    <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      {formatCurrency(p.amountToPay, p.currency)}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.date')}</span>
                <span className="text-sm text-gray-500">{formatDate(p.createdAt)}</span>
              </div>
            </div>
          )}
        />
        {packages.length === 0 && (
          <p className="text-center py-8 text-gray-400">{t('client.noPackages')}</p>
        )}
      </Card>
    </div>
  );
}
