import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { toggleTheme, openSidebar } from '../../store/slices/uiSlice';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logout } from '../../store/slices/authSlice';
import { authService } from '../../services/auth.service';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const theme = useSelector((state: RootState) => state.ui.theme);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    dispatch(logout());
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        {isMobile && (
          <button
            onClick={() => dispatch(openSidebar())}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Abrir menú"
          >
            ☰
          </button>
        )}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {user?.name} <span className="text-xs ml-2 opacity-60 hidden sm:inline">({user?.roleName})</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <button
          onClick={() => dispatch(toggleTheme())}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        >
          Salir
        </button>
      </div>
    </header>
  );
}