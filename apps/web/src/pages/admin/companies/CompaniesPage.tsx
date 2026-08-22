import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { companyService, Company, License } from '../../../services/company.service';
import { RootState } from '../../../store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [licenses, setLicenses] = useState<Record<string, License>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await companyService.findAll({ search, limit: 50 });
      setCompanies(res.data);
      // Fetch licenses for all companies
      const licensesRes = await companyService.getLicenses({ limit: 100 });
      const licenseMap: Record<string, License> = {};
      if (licensesRes.data) {
        licensesRes.data.forEach((lic) => {
          const companyId = typeof lic.companyId === 'string' ? lic.companyId : lic.companyId._id;
          // Keep the most recent license per company
          if (!licenseMap[companyId] || new Date(lic.createdAt) > new Date(licenseMap[companyId].createdAt)) {
            licenseMap[companyId] = lic;
          }
        });
      }
      setLicenses(licenseMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Only superadmin can see this page
  if (user?.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('common.noAccess')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('companies.title')}</h1>
        <Button onClick={() => navigate('/companies/new')}>{t('companies.new')}</Button>
      </div>

      <Card className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder={t('companies.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary" onClick={loadCompanies}>{t('common.search')}</Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('companies.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium">{t('common.name')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('companies.slug')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('common.email')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('companies.plan')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('companies.license')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('common.status')}</th>
                  <th className="text-left py-3 px-4 font-medium">{t('common.created')}</th>
                  <th className="text-right py-3 px-4 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-medium">{c.name}</td>
                    <td className="py-3 px-4 text-gray-500">{c.slug}</td>
                    <td className="py-3 px-4">{c.email}</td>
                    <td className="py-3 px-4">{c.planId?.name || t('companies.noPlan')}</td>
                    <td className="py-3 px-4">
                      {licenses[c._id] ? (
                        <Badge variant={licenses[c._id].status === 'active' ? 'success' : licenses[c._id].status === 'trial' ? 'warning' : 'danger'}>
                          {licenses[c._id].status}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={c.isActive ? 'success' : 'danger'}>
                        {c.isActive ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/companies/${c._id}/edit`)}
                          className="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(t('confirm.deleteCompany', { name: c.name, databaseName: c.databaseName }))) return;
                            try {
                              await companyService.deleteCompany(c._id);
                              loadCompanies();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
