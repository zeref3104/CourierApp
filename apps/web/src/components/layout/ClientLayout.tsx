import { Outlet } from 'react-router-dom';

export default function ClientLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary-600">Mi Courier</h1>
          <nav className="flex gap-4 text-sm">
            <a href="/client" className="text-gray-600 dark:text-gray-300 hover:text-primary-600">Dashboard</a>
            <a href="/client/packages" className="text-gray-600 dark:text-gray-300 hover:text-primary-600">Mis Paquetes</a>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}