import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';

export type ScanState = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

interface ScanResultProps {
  state: ScanState;
  pkg: any | null;
  scannedCode: string;
  onReset: () => void;
}

export function ScanResult({ state, pkg, scannedCode, onReset }: ScanResultProps) {
  const { t } = useTranslation();

  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <Card>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t('common.searching')}</span>
        </div>
      </Card>
    );
  }

  if (state === 'error') {
    return (
      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-600">
            <span className="text-xl">⚠️</span>
            <span className="font-medium">{t('scanner.error')}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={onReset}>
            {t('scanner.scanAgain')}
          </Button>
        </div>
      </Card>
    );
  }

  if (state === 'not_found') {
    return (
      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-red-600">
            <span className="text-xl">❌</span>
            <span className="font-medium">{t('scanner.notFound')}</span>
          </div>
          <p className="text-xs text-gray-500 font-mono">{t('scanner.trackingScanned')}: {scannedCode}</p>
          <Button size="sm" variant="secondary" onClick={onReset}>
            {t('scanner.scanAgain')}
          </Button>
        </div>
      </Card>
    );
  }

  // state === 'found'
  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-600">
          <span className="text-xl">✅</span>
          <span className="font-medium text-lg">{t('scanner.received')}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">{t('packages.tracking')}</p>
            <p className="font-mono font-medium">{pkg.tracking}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('common.customer')}</p>
            <p className="font-medium">{pkg.customerId?.name} {pkg.customerId?.lastName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('common.status')}</p>
            <StatusBadge status={pkg.status} />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('common.branch')}</p>
            <p className="font-medium">{pkg.branchId?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('packages.description')}</p>
            <p className="font-medium truncate">{pkg.description}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('packages.weight')}</p>
            <p className="font-medium">{pkg.weight} lbs</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('packages.total')}</p>
            <p className="font-medium">{formatCurrency(pkg.total)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('packages.received')}</p>
            <p className="font-medium">{formatDate(pkg.receivedAt)}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button size="sm" variant="secondary" onClick={onReset}>
            {t('scanner.scanAgain')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
