import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bell } from 'lucide-react';
import { RootState } from '../../store';
import { setUnreadCount } from '../../store/slices/notificationSlice';
import { notificationService } from '../../services/notification.service';
import { onSocketEvent } from '../../services/socketEvents';
import { formatRelative } from '../../utils/formatDate';

export default function NotificationBell() {
  const dispatch = useDispatch();
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const loadUnread = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      dispatch(setUnreadCount(res.data?.count ?? 0));
    } catch {
      // ignore — badge stays as-is
    }
  }, [dispatch]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await notificationService.findAll({ limit: 10 });
      setList(res.data);
    } catch {
      setError('No se pudieron cargar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial unread count
  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  // Refresh when the server pushes a new notification
  useEffect(() => {
    return onSocketEvent('socket:notifications-changed', () => {
      loadUnread();
      if (open) loadList();
    });
  }, [loadUnread, loadList, open]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      if (!prev) {
        loadUnread();
        loadList();
      }
      return !prev;
    });
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setList((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      loadUnread();
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      dispatch(setUnreadCount(0));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="text-center text-sm text-gray-400 py-6">Cargando...</p>}
            {!loading && error && <p className="text-center text-sm text-red-500 py-6">{error}</p>}
            {!loading && !error && list.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No tienes notificaciones</p>
            )}
            {!loading &&
              !error &&
              list.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleMarkAsRead(n._id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    n.isRead ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
