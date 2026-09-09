import api from '../config/axios';

/**
 * Resolve a possibly-relative logo URL against the API origin so the
 * browser fetches the image from the correct server (the API) even when
 * the frontend is served from a different origin.
 */
function resolveApiUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // api.defaults.baseURL is e.g. "https://api.charmeurexpress.us/api/v1"
  const apiBase = api.defaults.baseURL || '';
  const origin = apiBase.replace(/\/api\/v\d+\/?$/, '');
  return `${origin}${url}`;
}

let cachedCompanyName: string | null = null;
let cachedLogoUrl: string | null = null;

export const settingsService = {
  async getCompanyName(): Promise<string> {
    if (cachedCompanyName) return cachedCompanyName;
    try {
      const res = await api.get('/settings');
      cachedCompanyName = res.data?.data?.company_name || '';
      return cachedCompanyName ?? '';
    } catch {
      return '';
    }
  },

  async getLogoUrl(): Promise<string | null> {
    if (cachedLogoUrl !== null) return cachedLogoUrl;
    try {
      const res = await api.get('/settings');
      const raw = res.data?.data?.logo_url || null;
      cachedLogoUrl = raw ? resolveApiUrl(raw) : null;
      return cachedLogoUrl;
    } catch {
      return null;
    }
  },

  /** Force refresh (e.g. after saving settings). */
  invalidateCompanyName() {
    cachedCompanyName = null;
  },

  invalidateLogoUrl() {
    cachedLogoUrl = null;
  },
};
