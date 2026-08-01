import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deliveryService } from '../../../services/delivery.service';
import { packageService } from '../../../services/package.service';
import { Card } from '../../../components/ui/Card';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useDebounce } from '../../../hooks/useDebounce';
import { useLiveRefresh } from '../../../hooks/useSocketEvents';
import { formatDate } from '../../../utils/formatDate';

const AVAILABLE_PACKAGE_STATUSES = ['disponible', 'en_reparto'];

// Maps delivery type values to their translation key suffix.
const TYPE_KEY_SUFFIX: Record<string, string> = {
  branch: 'Branch',
  home: 'Home',
};

export default function DeliveryListPage() {
  const { t } = useTranslation();
  const typeLabel = (type: string) => t(`deliveries.type${TYPE_KEY_SUFFIX[type] || ''}`, { defaultValue: type });
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [completingId, setCompletingId] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, search: debouncedSearch };
      if (typeFilter) params.type = typeFilter;
      const res = await deliveryService.findAll(params);
      setDeliveries(res.data);
      if (res.meta) setMeta(res.meta);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [debouncedSearch, typeFilter]);

  useLiveRefresh('socket:deliveries-changed', () => load(meta.page));

  const handleComplete = async (d: any) => {
    if (!window.confirm(t('confirm.completeDelivery', { tracking: d.packageId?.tracking || '' }))) return;
    setCompletingId(d._id);
    try {
      await deliveryService.complete(d._id);
      load(meta.page);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || t('deliveries.completeError'));
    } finally {
      setCompletingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('deliveries.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t('deliveries.new')}</Button>
      </div>

      <div className="flex gap-4">
        <div className="max-w-sm flex-1">
          <Input
            placeholder={t('deliveries.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="🔍"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">{t('deliveries.allTypes')}</option>
          <option value="branch">{t('deliveries.typeBranch')}</option>
          <option value="home">{t('deliveries.typeHome')}</option>
        </select>
      </div>

      <Card padding={false}>
        <Table
          headers={[t('packages.tracking'), t('common.customer'), t('common.address'), t('deliveries.deliveredBy'), t('deliveries.type'), t('common.date'), t('common.actions')]}
          items={deliveries}
          loading={loading}
          renderRow={(d) => (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('packages.tracking')}</span>
                <span className="font-mono text-sm font-medium">{d.packageId?.tracking || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.customer')}</span>
                <span>{d.packageId?.customerId ? `${d.packageId.customerId.name || ''} ${d.packageId.customerId.lastName || ''}`.trim() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.address')}</span>
                <span className="text-sm">{d.address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('deliveries.deliveredBy')}</span>
                <span>{d.deliveredById?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('deliveries.type')}</span>
                <span><Badge variant={d.type === 'branch' ? 'info' : 'default'}>{typeLabel(d.type)}</Badge></span>
              </div>

              <div className="flex justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.date')}</span>
                <span className="text-gray-500 text-sm">{formatDate(d.deliveredAt || d.createdAt)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
                <Link to={`/packages/${d.packageId?._id || d._id}`} className="text-primary-600 hover:text-primary-700 text-sm">
                  {t('deliveries.viewPackage')}
                </Link>
                {d.type === 'branch' || d.packageId?.status === 'entregado' ? (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">{t('deliveries.completed')}</span>
                ) : (
                  <Button size="sm" onClick={() => handleComplete(d)} loading={completingId === d._id}>
                    {t('deliveries.complete')}
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={load} />

      {createOpen && (
        <DeliveryCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load(1);
          }}
        />
      )}
    </div>
  );
}

function DeliveryCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [type, setType] = useState('home');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDocument, setReceiverDocument] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    packageService.findAll({ search: debouncedSearch, limit: 10 })
      .then((r) => {
        const list = r.data || [];
        setSearchResults(list.filter((p: any) => AVAILABLE_PACKAGE_STATUSES.includes(p.status)));
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;

    setSubmitting(true);
    try {
      await deliveryService.create({
        packageId: selectedPackage._id,
        type,
        receiverName,
        receiverDocument,
        receiverPhone: receiverPhone || undefined,
        address: address || undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || t('deliveries.registerError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold">{t('deliveries.new')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Package — search + dropdown */}
          <div ref={searchRef}>
            <label className="block text-sm font-medium mb-1">{t('common.package')}</label>
            {selectedPackage ? (
              <div className="flex items-center justify-between rounded-lg border border-primary-500 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono font-medium">{selectedPackage.tracking}</span>
                  <span className="ml-2 text-gray-500">{selectedPackage.description}</span>
                  <span className="ml-2 text-gray-400">{t(`status.${selectedPackage.status}`, { defaultValue: selectedPackage.status })}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPackage(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder={t('deliveries.packageSearchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  icon="🔍"
                />
                {showDropdown && debouncedSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searching ? (
                      <div className="px-3 py-2 text-sm text-gray-400">{t('common.searching')}</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">{t('common.noResults')}</div>
                    ) : (
                      searchResults.map((p: any) => (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => {
                            setSelectedPackage(p);
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <span className="font-mono font-medium">{p.tracking}</span>
                          <span className="ml-2 text-gray-500">{p.description}</span>
                          {p.customerId?.name && <span className="ml-2 text-gray-400">{p.customerId.name}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('deliveries.typeLabel')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="home">{t('deliveries.typeHome')}</option>
              <option value="branch">{t('deliveries.typeBranch')}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('deliveries.receiverName')} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} required />
            <Input label={t('deliveries.receiverDocument')} value={receiverDocument} onChange={(e) => setReceiverDocument(e.target.value)} required />
          </div>
          <Input label={t('deliveries.receiverPhone')} value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
          {type === 'home' && (
            <Input label={t('common.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
          )}
          <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={submitting} disabled={!selectedPackage}>
              {t('deliveries.register')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
