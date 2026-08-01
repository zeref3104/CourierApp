/**
 * Type-safe translation keys for i18next.
 *
 * `resources` is keyed by the single `translation` namespace: i18next v26
 * derives FlatNamespace = keyof resources, so flat dotted keys (e.g.
 * `nav.dashboard`) must live under the `translation` namespace for the
 * typed gate to resolve. Missing key => tsc error at the call site.
 *
 * NOTE — what this gate does and does NOT cover (verified with a tsc
 * fixture, 2026-07-31):
 *  - It validates KEYS USED IN CODE against es.json (call-site gate). A key
 *    absent from es.json fails `t('...')` with TS2345.
 *  - It does NOT validate en/fr completeness. The `en as typeof es` /
 *    `fr as typeof es` casts in index.ts are comparability assertions that
 *    both a SUBSET (missing key) and a SUPERSET (extra key) satisfy, so tsc
 *    accepts either direction. en/fr completeness is enforced by
 *    `scripts/check-i18n.mjs` (deep diff + interpolation parity), which runs
 *    as part of the web build after `vite build`.
 */
import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof import('./locales/es.json');
    };
  }
}
