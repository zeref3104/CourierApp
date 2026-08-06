import es from '../locales/es.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import { t, setI18nLanguage, DEFAULT_LANGUAGE } from '@/i18n';

/**
 * Full i18n system tests (task 5.9): the three locale files must stay key-
 * aligned (a key added in one language must exist in all three), and the
 * `recibido_miami` status label must resolve through the `status.*` key in
 * every language (5.9 AC — no hardcoded status slugs in the UI).
 */
describe('i18n locale alignment', () => {
  it('es/en/fr expose identical key sets', () => {
    const esKeys = Object.keys(es).sort();
    expect(Object.keys(en).sort()).toEqual(esKeys);
    expect(Object.keys(fr).sort()).toEqual(esKeys);
  });

  it('default language is es (spec default, matches web + OTP email D6)', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  it('every value carries the {{param}} placeholders used by the app', () => {
    // Placeholder-bearing keys: welcome ({{name}}), otp.subtitle ({{email}}),
    // otp.resendIn ({{seconds}}). If a locale loses a placeholder, t() would
    // render a literal "{{name}}".
    for (const locale of [es, en, fr]) {
      expect(locale['dashboard.welcome']).toContain('{{name}}');
      expect(locale['otp.subtitle']).toContain('{{email}}');
      expect(locale['otp.resendIn']).toContain('{{seconds}}');
    }
  });
});

describe('i18n resolution', () => {
  it('resolves the recibido_miami label via the status.* key in every language (5.9 AC)', () => {
    setI18nLanguage('es');
    expect(t('status.recibido_miami')).toBe(es['status.recibido_miami']);
    setI18nLanguage('en');
    expect(t('status.recibido_miami')).toBe(en['status.recibido_miami']);
    setI18nLanguage('fr');
    expect(t('status.recibido_miami')).toBe(fr['status.recibido_miami']);
  });

  it('interpolates {{params}} in the active language', () => {
    setI18nLanguage('es');
    expect(t('dashboard.welcome', { name: 'Ana' })).toBe('Hola, Ana');
    setI18nLanguage('fr');
    expect(t('dashboard.welcome', { name: 'Ana' })).toBe('Bonjour, Ana');
  });

  it('returns the key itself when it exists in no locale (never blanks the UI)', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
