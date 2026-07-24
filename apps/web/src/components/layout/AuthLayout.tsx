import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';

export default function AuthLayout() {
  useEffect(() => {
    document.title = 'Courier Manager - Login';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}