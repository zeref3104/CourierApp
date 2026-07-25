import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { cn } from '../../utils/cn';

export default function AdminLayout() {
  const collapsed = useSelector((state: RootState) => state.ui.sidebarCollapsed);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar is fixed — always out of flex flow */}
      <Sidebar />
      <div
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-300',
          // On desktop: compensate for the fixed sidebar width
          isDesktop && (collapsed ? 'ml-16' : 'ml-64')
        )}
      >
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}