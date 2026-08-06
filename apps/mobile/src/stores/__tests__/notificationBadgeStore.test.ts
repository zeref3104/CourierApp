import { useNotificationBadgeStore } from '../notificationBadgeStore';

describe('notificationBadgeStore', () => {
  beforeEach(() => {
    useNotificationBadgeStore.setState({ unread: 0 });
  });

  it('starts at zero', () => {
    expect(useNotificationBadgeStore.getState().unread).toBe(0);
  });

  it('setUnread replaces the count', () => {
    useNotificationBadgeStore.getState().setUnread(7);
    expect(useNotificationBadgeStore.getState().unread).toBe(7);
  });

  it('increment adds one', () => {
    useNotificationBadgeStore.getState().setUnread(2);
    useNotificationBadgeStore.getState().increment();
    expect(useNotificationBadgeStore.getState().unread).toBe(3);
  });

  it('clear resets to zero', () => {
    useNotificationBadgeStore.getState().setUnread(9);
    useNotificationBadgeStore.getState().clear();
    expect(useNotificationBadgeStore.getState().unread).toBe(0);
  });
});