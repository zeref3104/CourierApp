import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { toggleSidebar, closeSidebar } from '../../store/slices/uiSlice';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../utils/cn';

export default function Sidebar() {
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const isSuperAdmin = user?.role === 'superadmin';

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: '📊' },
    ...(isSuperAdmin
      ? [{ label: 'Empresas', path: '/companies', icon: '🏢' }]
      : []),
    { label: 'Clientes', path: '/customers', icon: '👥' },
    { label: 'Paquetes', path: '/packages', icon: '📦' },
    { label: 'Pagos', path: '/payments', icon: '💰' },
    { label: 'Entregas', path: '/deliveries', icon: '🚚' },
    { label: 'Usuarios', path: '/users', icon: '👤' },
    { label: 'Sucursales', path: '/branches', icon: '🏢' },
    { label: 'Reportes', path: '/reports', icon: '📈' },
    { label: 'Configuración', path: '/settings', icon: '⚙️' },
  ];

  const handleNavClick = () => {
    if (!isDesktop) {
      dispatch(closeSidebar());
    }
  };

  return (
    <>
      {/* Backdrop — mobile only */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => dispatch(closeSidebar())}
        />
      )}

      <aside
        className={cn(
          'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300',
          isDesktop
            ? // Desktop: fixed, always visible, collapsible width
              cn('fixed inset-y-0 left-0 z-40', collapsed ? 'w-16' : 'w-64')
            : // Mobile: fixed drawer that slides in
              cn(
                'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              )
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          {isDesktop && collapsed ? (
            <span className="text-xl font-bold text-primary-600 mx-auto">C</span>
          ) : (
            <span className="text-lg font-bold text-primary-600">Courier Manager</span>
          )}
        </div>

        {/* Toggle / Close — desktop: collapse toggle, mobile: close button */}
        {isDesktop ? (
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="p-2 m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 self-end"
          >
            {collapsed ? '→' : '←'}
          </button>
        ) : (
          <button
            onClick={() => dispatch(closeSidebar())}
            className="p-2 m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 self-end"
          >
            ✕
          </button>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )
              }
            >
              <span className="text-lg">{item.icon}</span>
              {/* Show label always on mobile, toggle on desktop */}
              {(!isDesktop || !collapsed) && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
