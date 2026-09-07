import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientService } from '../../services/client.service';
import { Card, StatCard } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { useLiveRefresh } from '../../hooks/useSocketEvents';
import { formatRelative } from '../../utils/formatDate';

export default function ClientDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await clientService.getDashboard();
      setData(r.data);
      setError('');
    } catch {
      setError(t('client.loadError'));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useLiveRefresh('socket:packages-changed', load);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Green welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-1">{t('client.welcomeBanner', { name: '' })}</h1>
          <p className="text-primary-100 text-sm">{t('client.welcomeSubtitle')}</p>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-6xl opacity-20">
          📦
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {!error && (
        <>
          {/* Stat cards with icons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/client/packages" className="block">
              <StatCard label={t('client.inTransit')} value={data?.inTransit || 0} icon="🚚" />
            </Link>
            <Link to="/client/packages" className="block">
              <StatCard label={t('client.available')} value={data?.readyForPickup || 0} icon="📦" />
            </Link>
            <Link to="/client/packages" className="block">
              <StatCard label={t('client.delivered')} value={data?.delivered || 0} icon="✅" />
            </Link>
            <Link to="/client/packages" className="block">
              <StatCard label={t('client.total')} value={data?.totalPackages || 0} icon="📋" />
            </Link>
          </div>

          {/* Recent packages */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('client.recentPackages')}</h2>
              <Link to="/client/packages" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                {t('common.viewAll')} →
              </Link>
            </div>
            {data?.lastTracking?.length > 0 ? (
              <div className="space-y-3">
                {data.lastTracking.map((p: any) => (
                  <Link key={p.tracking} to={`/client/packages/${p.tracking}`} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-medium font-mono">{p.tracking}</p>
                      <p className="text-xs text-gray-500">{formatRelative(p.createdAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm text-gray-400">{t('client.emptyDashboard')}</p>
              </div>
            )}
          </Card>

          {/* WhatsApp help section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-sm font-semibold">{t('client.needHelp')}</p>
                <p className="text-xs text-gray-500">{t('client.helpSubtitle')}</p>
              </div>
            </div>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {t('client.contactWhatsApp')}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
