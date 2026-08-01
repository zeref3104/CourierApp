/**
 * i18n translation completeness check for @courier/web.
 *
 * Fails (exit 1) when:
 *   - a key present in es.json is missing from en.json or fr.json, or
 *   - en/fr contain keys that do not exist in es.json (drift), or
 *   - interpolation parameter names ({{x}}) differ across locales for the
 *     same key (a mismatch produces broken output at runtime).
 *
 * Run from the repo root:  node scripts/check-i18n.mjs
 * Or via npm (workspace):  npm run check:i18n --workspace @courier/web
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'apps', 'web', 'src', 'i18n', 'locales');

function readLocale(file) {
  return JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
}

const es = readLocale('es.json');
const en = readLocale('en.json');
const fr = readLocale('fr.json');

const interpolationParams = (value) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

const errors = [];

for (const [lang, resource] of [['en', en], ['fr', fr]]) {
  const missing = Object.keys(es).filter((key) => !(key in resource));
  if (missing.length > 0) {
    errors.push(`[${lang}] ${missing.length} key(s) missing: ${missing.join(', ')}`);
  }
  const extra = Object.keys(resource).filter((key) => !(key in es));
  if (extra.length > 0) {
    errors.push(`[${lang}] ${extra.length} extra key(s) not present in es: ${extra.join(', ')}`);
  }
  for (const key of Object.keys(es)) {
    if (!(key in resource)) continue;
    const esParams = interpolationParams(es[key]);
    const langParams = interpolationParams(resource[key]);
    if (JSON.stringify(esParams) !== JSON.stringify(langParams)) {
      errors.push(
        `[${lang}] key "${key}" interpolation params differ ` +
          `(es: {${esParams.join(', ')}} vs ${lang}: {${langParams.join(', ')}})`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('i18n completeness check FAILED:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const totalKeys = Object.keys(es).length;
console.log(
  `i18n completeness check PASSED: ${totalKeys} keys in es, en and fr ` +
    `(0 missing, 0 extra, interpolation params aligned)`,
);
