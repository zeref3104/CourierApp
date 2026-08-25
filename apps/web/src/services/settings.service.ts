import api from '../config/axios';

let cachedCompanyName: string | null = null;

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

  /** Force refresh (e.g. after saving settings). */
  invalidateCompanyName() {
    cachedCompanyName = null;
  },
};
