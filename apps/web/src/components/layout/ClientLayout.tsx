import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function ClientLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">Mi Courier</h1>
          <nav className="flex items-center gap-4">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              onClick={() => setNavOpen(!navOpen)}
              aria-label={navOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={navOpen}
            >
              {navOpen ? '✕' : '☰'}
            </button>
            <div className={navOpen ? 'fixed inset-0 z-40 md:static md:inset-auto md:z-auto bg-white dark:bg-gray-800 md:bg-transparent md:flex md:flex-row flex-col md:items-center md:gap-4 p-6 md:p-0 transition-all duration-300' : 'hidden'}>
              <Link to="/client" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>Dashboard</Link>
              <Link to="/client/packages" className="text-gray-600 dark:text-gray-300 hover:text-primary-600 py-2 md:py-0 block md:inline" onClick={() => setNavOpen(false)}>Mis Paquetes</Link>
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