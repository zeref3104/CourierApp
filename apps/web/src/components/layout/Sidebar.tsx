import { NavLink } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { cn } from '../../utils/cn';

const menuItems = [
  { label: 'Dashboard', path: '/', icon: '📊' },
  { label: 'Clientes', path: '/customers', icon: '👥' },
  { label: 'Paquetes', path: '/packages', icon: '📦' },
  { label: 'Pagos', path: '/payments', icon: '💰' },
  { label: 'Entregas', path: '/deliveries', icon: '🚚' },
  { label: 'Usuarios', path: '/users', icon: '👤' },
  { label: 'Sucursales', path: '/branches', icon: '🏢' },
  { label: 'Reportes', path: '/reports', icon: '📈' },
  { label: 'Configuración', path: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const dispatch = useDispatch();

  return (
    <aside
      className={cn(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
        {collapsed ? (
          <span className="text-xl font-bold text-primary-600 mx-auto">C</span>
        ) : (
          <span className="text-lg font-bold text-primary-600">Courier Manager</span>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => dispatch(toggleSidebar())}
        className="p-2 m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 self-end"
      >
        {collapsed ? '→' : '←'}
      </button>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
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
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}