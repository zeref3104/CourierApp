import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { branchService } from '../../../services/branch.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';

export default function BranchListPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await branchService.findAll();
      setBranches(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = branches.filter((b) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.code || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('branches.title')}</h1>
        <Link to="/branches/new">
          <Button>{t('branches.new')}</Button>
        </Link>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder={t('branches.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="🔍"
        />
      </div>

      <Card padding={false}>
        <Table
          headers={[t('common.name'), t('common.code'), t('common.address'), t('common.phone'), t('common.status'), t('common.actions')]}
          items={filtered}
          loading={loading}
          renderRow={(b) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.name')}</span>
                <span className="font-medium">{b.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.code')}</span>
                <span className="font-mono text-sm">{b.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.address')}</span>
                <span className="text-sm text-gray-500">{b.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.phone')}</span>
                <span>{b.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.status')}</span>
                <span><Badge variant={b.isActive !== false ? 'success' : 'danger'}>{b.isActive !== false ? t('common.active') : t('common.inactive')}</Badge></span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end">
                <Link to={`/branches/${b._id}/edit`} className="text-primary-600 hover:text-primary-700 text-sm">
                  {t('common.edit')}
                </Link>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
