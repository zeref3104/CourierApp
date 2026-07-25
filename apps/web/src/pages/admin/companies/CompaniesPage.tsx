import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { companyService, Company } from '../../../services/company.service';
import { RootState } from '../../../store';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const [companies, setCompanies] = useState<Company[]>([]);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Solo superadmin puede ver esta página
  if (user?.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No tienes acceso a esta página</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <Button onClick={() => navigate('/companies/new')}>Nueva Empresa</Button>
      </div>

      <Card className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, slug o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary" onClick={loadCompanies}>Buscar</Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : companies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay empresas creadas aún
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium">Slug</th>
                  <th className="text-left py-3 px-4 font-medium">Email</th>
                  <th className="text-left py-3 px-4 font-medium">Plan</th>
                  <th className="text-left py-3 px-4 font-medium">Estado</th>
                  <th className="text-left py-3 px-4 font-medium">Creado</th>
                  <th className="text-right py-3 px-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-medium">{c.name}</td>
                    <td className="py-3 px-4 text-gray-500">{c.slug}</td>
                    <td className="py-3 px-4">{c.email}</td>
                    <td className="py-3 px-4">{c.planId?.name || 'Sin plan'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={c.isActive ? 'success' : 'danger'}>
                        {c.isActive ? 'Activo' : 'Inactivo'}
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
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar "${c.name}" permanentemente? También se borrará su base de datos (${c.databaseName}). Esta acción NO se puede deshacer.`)) return;
                            try {
                              await companyService.deleteCompany(c._id);
                              loadCompanies();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Eliminar
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
