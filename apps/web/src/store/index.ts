import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import packageReducer from './slices/packageSlice';
import customerReducer from './slices/customerSlice';
import notificationReducer from './slices/notificationSlice';

// Load persisted auth from localStorage
function loadPersistedAuth() {
  try {
    const raw = localStorage.getItem('auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.accessToken && parsed.user) {
        return { user: parsed.user, accessToken: parsed.accessToken };
      }
    }
  } catch {}
  return null;
}

const persisted = loadPersistedAuth();

const preloadedState = persisted
  ? {
      auth: {
        user: persisted.user,
        accessToken: persisted.accessToken,
        isAuthenticated: true,
      },
    }
  : undefined;

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    packages: packageReducer,
    customers: customerReducer,
    notifications: notificationReducer,
  },
  preloadedState,
});

// Persist auth on every change
let previousAuth: string | null = null;
store.subscribe(() => {
  const { auth } = store.getState();
  if (auth.isAuthenticated) {
    const current = JSON.stringify({ user: auth.user, accessToken: auth.accessToken });
    if (current !== previousAuth) {
      localStorage.setItem('auth', current);
      previousAuth = current;
    }
  } else {
    localStorage.removeItem('auth');
    previousAuth = null;
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;