import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

/**
 * Service worker registration + update prompt.
 *
 * registerType is 'prompt' (not autoUpdate) because the app holds live data
 * (socket.io, dashboards); the new worker waits until the user explicitly
 * reloads, so in-flight state is never wiped by a mid-session SW takeover.
 */
export default function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (offlineReady) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 rounded-lg bg-primary-700 px-4 py-3 text-sm text-white shadow-lg"
      >
        {t('pwa.offlineReady')}{' '}
        <button
          type="button"
          className="underline"
          onClick={() => setOfflineReady(false)}
        >
          {t('pwa.offlineReadyAction')}
        </button>
      </div>
    );
  }

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 rounded-lg bg-primary-700 px-4 py-3 text-sm text-white shadow-lg"
    >
      {t('pwa.updateAvailable')}{' '}
      <button
        type="button"
        className="underline"
        onClick={() => updateServiceWorker(true)}
      >
        {t('pwa.updateAction')}
      </button>
    </div>
  );
}
