import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import { CARRIER_LABELS } from '@courier/constants';

export default function MyPackagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [packages, setPackages] = useState<any[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<{ totalBalance: number; currency: string } | null>(null);

  const load = useCallback(async () => {
    const api = (await import('../../config/axios')).default;
    const res = await api.get('/client/packages');
    setPackages(res.data.data || []);
    if (res.data.summary) {
      setBalanceSummary(res.data.summary);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('nav.myPackages')}</h1>
      {balanceSummary && balanceSummary.totalBalance > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="text-sm text-gray-500">{t('client.balanceSummary')}</p>
              <p className="text-lg font-bold">{t('client.totalBalance')}: {formatCurrency(balanceSummary.totalBalance, balanceSummary.currency)}</p>
            </div>
          </div>
        </Card>
      )}
      <Card padding={false}>
        <Table
          headers={[t('packages.tracking'), t('packages.description'), t('packages.weight'), t('common.status'), t('common.date')]}
          items={packages}
          renderRow={(p) => (
            <div
              className="flex flex-col gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-4 px-4 py-2 rounded-lg transition-colors"
              onClick={() => navigate(`/client/packages/${p.tracking}`)}
            >
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.tracking')}</span>
                <span className="font-mono font-medium text-primary-600">{p.tracking}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.description')}</span>
                <span>{p.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.weight')}</span>
                <span>{p.weight} lbs</span>
              </div>
              {p.carrier && p.carrier !== 'other' && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.carrier')}</span>
                  <span>{CARRIER_LABELS[p.carrier] || p.carrier}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
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
