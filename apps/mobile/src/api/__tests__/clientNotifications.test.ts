import { fetchNotifications, registerDeviceToken } from '@/api/clientNotifications';
import { api } from '@/lib/api';

// Mock the shared axios client so these stay pure contract tests (no network).
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;

describe('clientNotifications API wrappers', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it('registerDeviceToken POSTs the token + platform and unwraps the result', async () => {
    apiPost.mockResolvedValue({
      data: { success: true, data: { registered: true, devices: 2 } },
    });

    const result = await registerDeviceToken('ExponentPushToken[abc123]', 'android');

    expect(apiPost).toHaveBeenCalledWith('/client/device-token', {
      token: 'ExponentPushToken[abc123]',
      platform: 'android',
    });
    expect(result).toEqual({ registered: true, devices: 2 });
  });

  it('fetchNotifications forwards pagination params and unwraps items + meta', async () => {
    apiGet.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: 'n1',
            type: 'package_status',
            title: 'Package received',
            message: 'Your package RB-000002 arrived in Miami',
            createdAt: '2026-08-03T09:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const result = await fetchNotifications({ page: 1, limit: 20 });

    expect(apiGet).toHaveBeenCalledWith('/client/notifications', { params: { page: 1, limit: 20 } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('package_status');
    expect(result.meta.totalPages).toBe(1);
  });
});
