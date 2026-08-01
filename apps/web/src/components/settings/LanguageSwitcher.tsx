import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  setLanguage,
  type SupportedLanguage,
} from '../../i18n';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
};

/** Language selector — mirrors the currency select styling on the settings page. */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value)}
      aria-label={t('settings.language')}
      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {LANGUAGE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
