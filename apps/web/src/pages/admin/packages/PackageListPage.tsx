import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { packageService } from '../../../services/package.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';
import { useLiveRefresh } from '../../../hooks/useSocketEvents';
import { formatDate, formatRelative } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';
import { printPackageLabel } from '../../../utils/packageLabel';
import { Printer } from 'lucide-react';

// Quick filter subset of the full status list (kept in sync with status.* keys).
const FILTER_STATUSES = ['recibido_miami', 'en_transito', 'disponible', 'entregado'];

export default function PackageListPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, search: debouncedSearch };
      if (statusFilter) params.status = statusFilter;
      const res = await packageService.findAll(params);
      setPackages(res.data);
      if (res.meta) setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch, statusFilter]);

  useLiveRefresh('socket:packages-changed', () => load(meta.page));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('packages.title')}</h1>
        <Link to="/packages/new">
          <button className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
            {t('packages.new')}
          </button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="max-w-sm flex-1">
          <Input
            placeholder={t('packages.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔍"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('packages.allStatuses')}</option>
          {FILTER_STATUSES.map((status) => (
            <option key={status} value={status}>{t(`status.${status}`, { defaultValue: status })}</option>
          ))}
        </select>
      </div>

      <Card padding={false}>
        <Table
          headers={[t('packages.tracking'), t('common.customer'), t('packages.weight'), t('packages.total'), t('common.status'), t('common.created'), t('common.actions')]}
          items={packages}
          loading={loading}
          renderRow={(p) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.tracking')}</span>
                <span className="font-mono text-sm font-medium">{p.tracking}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.customer')}</span>
                <span>{p.customerId?.name} {p.customerId?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.weight')}</span>
                <span>{p.weight} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.total')}</span>
                <span>{formatCurrency(p.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.status')}</span>
                <span><StatusBadge status={p.status} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.created')}</span>
                <span className="text-gray-500 text-xs">{formatRelative(p.createdAt)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={() => printPackageLabel(p)} className="gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  {t('packages.printLabel')}
                </Button>
                <Link to={`/packages/${p._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                  {t('common.viewDetails')}
                </Link>
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />
    </div>
  );
}
