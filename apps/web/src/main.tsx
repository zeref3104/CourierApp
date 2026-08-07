import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n';
import './index.css';

// --- Boot diagnostics (temporary) ---
console.log('[boot] href:', window.location.href);
console.log('[boot] VITE_API_URL:', import.meta.env.VITE_API_URL || '(not set -> fallback /api/v1)');
console.log('[boot] boot errors caught before bundle:', window.__BOOT_ERRORS__);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);