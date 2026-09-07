import { useTranslation } from 'react-i18next';

export default function ClientSupportPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div className="text-center">
        <span className="text-5xl">💬</span>
        <h1 className="text-2xl font-bold mt-4">{t('support.title')}</h1>
        <p className="text-gray-500 mt-1">{t('support.subtitle')}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <span className="text-3xl">📱</span>
        <h2 className="text-lg font-semibold mt-2">{t('support.whatsapp')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('support.whatsappDesc')}</p>
        <a
          href="https://wa.me/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {t('support.contactNow')}
        </a>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <span className="text-3xl">📧</span>
        <h2 className="text-lg font-semibold mt-2">{t('support.email')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('support.emailDesc')}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <span className="text-3xl">🕐</span>
        <h2 className="text-lg font-semibold mt-2">{t('support.hours')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('support.hoursDesc')}</p>
      </div>
    </div>
  );
}
