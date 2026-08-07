import { fetchDashboard, fetchPackages, fetchPackageByTracking, fetchProfile, updateProfile } from '@/api/clientPanel';
import { api } from '@/lib/api';

// Mock the shared axios client so these stay pure contract tests (no network).
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const apiGet = api.get as jest.Mock;
const apiPatch = api.patch as jest.Mock;

describe('clientPanel API wrappers', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPatch.mockReset();
  });

  it('fetchDashboard returns the stats payload', async () => {
    const stats = {
      totalPackages: 12,
      inTransit: 3,
      readyForPickup: 1,
      delivered: 8,
      lastTracking: [{ tracking: 'RB-000001', status: 'en_transito', createdAt: '2026-08-01T10:00:00Z' }],
    };
    apiGet.mockResolvedValue({ data: { success: true, data: stats } });

    const result = await fetchDashboard();

    expect(apiGet).toHaveBeenCalledWith('/client/dashboard');
    expect(result).toEqual(stats);
  });

  it('fetchPackages forwards status + pagination params and unwraps meta', async () => {
    apiGet.mockResolvedValue({
      data: {
        success: true,
        data: [{ _id: 'p1', tracking: 'RB-000002', status: 'disponible', createdAt: '2026-08-02T10:00:00Z' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });

    const result = await fetchPackages({ status: 'disponible', page: 1, limit: 20 });

    expect(apiGet).toHaveBeenCalledWith('/client/packages', {
      params: { status: 'disponible', page: 1, limit: 20 },
    });
    expect(result.items).toHaveLength(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('fetchPackageByTracking encodes the tracking code and returns the detail', async () => {
    const detail = {
      _id: 'p1',
      tracking: 'RB-000002',
      status: 'disponible',
      amountToPay: 45.5,
      pickupBranch: { id: 'b1', name: 'Santo Domingo', address: 'Av. 27' },
      history: [{ status: 'recibido_miami', createdAt: '2026-07-30T10:00:00Z' }],
    };
    apiGet.mockResolvedValue({ data: { success: true, data: detail } });

    const result = await fetchPackageByTracking('RB-000002');

    expect(apiGet).toHaveBeenCalledWith('/client/packages/RB-000002');
    expect(result.tracking).toBe('RB-000002');
    expect(result.amountToPay).toBe(45.5);
  });

  it('fetchProfile returns the customer profile document', async () => {
    const profile = {
      _id: 'c1',
      code: 'RB-000001',
      name: 'Ana',
      lastName: 'Gomez',
      email: 'ana@example.com',
      phone: '809-555-0100',
      address: 'Av. 27',
      branchId: { _id: 'b1', name: 'Santo Domingo' },
    };
    apiGet.mockResolvedValue({ data: { success: true, data: profile } });

    const result = await fetchProfile();

    expect(apiGet).toHaveBeenCalledWith('/client/profile');
    expect(result.code).toBe('RB-000001');
    expect(result.branchId?.name).toBe('Santo Domingo');
  });

  it('updateProfile PATCHes the updatable fields and returns the updated profile', async () => {
    const updated = {
      _id: 'c1',
      code: 'RB-000001',
      name: 'Ana',
      lastName: 'Gomez',
      email: 'ana.nueva@example.com',
      phone: '809-555-0199',
      address: 'Av. Independencia',
    };
    apiPatch.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updateProfile({ email: 'ana.nueva@example.com', phone: '809-555-0199', address: 'Av. Independencia' });

    expect(apiPatch).toHaveBeenCalledWith('/client/profile', {
      email: 'ana.nueva@example.com',
      phone: '809-555-0199',
      address: 'Av. Independencia',
    });
    expect(result).toEqual(updated);
  });
});
