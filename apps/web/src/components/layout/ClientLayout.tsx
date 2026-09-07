import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../../store';
import { authService } from '../../services/auth.service';
import { logout } from '../../store/slices/authSlice';
import { clearClientRefreshToken } from '../../utils/clientAuthStorage';
import { settingsService } from '../../services/settings.service';

const BOTTOM_TABS = [
  { to: '/client', icon: '🏠', labelKey: 'client.tabHome' },
  { to: '/client/packages', icon: '📦', labelKey: 'client.tabPackages' },
  { to: '/client/support', icon: '💬', labelKey: 'client.tabSupport' },
  { to: '/client/profile', icon: '👤', labelKey: 'client.tabAccount' },
];

export default function ClientLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    settingsService.getLogoUrl().then(setLogoUrl);
    settingsService.getCompanyName().then(setCompanyName);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    clearClientRefreshToken();
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/client" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-lg font-bold text-primary-600">{companyName || t('nav.myCourier')}</span>
            )}
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-3">
                <span className="font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
                {user.roleName && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {user.roleName}
                  </span>
                )}
              </div>
            )}
          </Link>
          <nav className="flex items-center gap-4">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              onClick={() => setNavOpen(!navOpen)}
              aria-label={navOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={navOpen}
            >
              {navOpen ? '✕' : '☰'}
            </button>
            <div className={`${navOpen ? 'fixed inset-0 z-40 bg-white dark:bg-gray-800 flex flex-col p-6 transition-all duration-300' : 'hidden'} md:static md:inset-auto md:z-auto md:bg-transparent md:flex md:flex-row md:items-center md:gap-4 md:p-0`}>
              <Link to="/client" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>{t('nav.dashboard')}</Link>
              <Link to="/client/packages" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>{t('nav.myPackages')}</Link>
              {user && (
                <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</p>
                  {user.roleName && <p className="text-xs text-gray-500">{user.roleName}</p>}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center h-16 z-50 md:hidden">
        {BOTTOM_TABS.map((tab) => {
          const active = location.pathname === tab.to || (tab.to !== '/client' && location.pathname.startsWith(tab.to));
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${active ? 'text-primary-600' : 'text-gray-400'}`}
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span className="text-[10px] font-semibold">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
