import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '../../store';
import { authService } from '../../services/auth.service';
import { logout } from '../../store/slices/authSlice';
import { clearClientRefreshToken } from '../../utils/clientAuthStorage';

export default function ClientLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    clearClientRefreshToken();
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Left: brand + client info */}
          <div className="flex items-center gap-3">
            <Link to="/client" className="text-lg font-bold text-primary-600">{t('nav.myCourier')}</Link>
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
          </div>

          {/* Right: nav links + logout */}
          <nav className="flex items-center gap-4">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              onClick={() => setNavOpen(!navOpen)}
              aria-label={navOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={navOpen}
            >
              {navOpen ? '✕' : '☰'}
            </button>
            <div className={navOpen ? 'fixed inset-0 z-40 md:static md:inset-auto md:z-auto bg-white dark:bg-gray-800 md:bg-transparent md:flex md:flex-row flex-col md:items-center md:gap-4 p-6 md:p-0 transition-all duration-300' : 'hidden'}>
              <Link to="/client" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>{t('nav.dashboard')}</Link>
              <Link to="/client/packages" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>{t('nav.myPackages')}</Link>
              {/* Client info — mobile only */}
              {user && (
                <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</p>
                  {user.roleName && <p className="text-xs text-gray-500">{user.roleName}</p>}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-left text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 py-2 md:py-0 block md:inline font-medium"
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
    </div>
  );
}
