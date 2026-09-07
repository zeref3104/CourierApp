import api from '../config/axios';

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
      cachedLogoUrl = res.data?.data?.logo_url || null;
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
