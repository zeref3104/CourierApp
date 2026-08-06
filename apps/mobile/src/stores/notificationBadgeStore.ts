import { create } from 'zustand';

/**
 * Lightweight unread-notification badge. Full notifications screen + Expo push
 * token registration arrive in slice 5c (tasks 5.7); this store is the kept
 * piece of app-global state the design mandates today so the badge already has
 * a single source of truth once the notifications feature lands.
 */
interface NotificationBadgeState {
  unread: number;
  setUnread: (count: number) => void;
  increment: () => void;
  clear: () => void;
}

export const useNotificationBadgeStore = create<NotificationBadgeState>((set) => ({
  unread: 0,
  setUnread: (count) => set({ unread: count }),
  increment: () => set((state) => ({ unread: state.unread + 1 })),
  clear: () => set({ unread: 0 }),
}));