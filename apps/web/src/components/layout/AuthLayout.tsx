import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `Courier Manager - ${t('nav.login')}`;
  }, [t, i18n.language]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
