import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Handle and suppress cross-origin iframe SecurityErrors
window.addEventListener(
  'error',
  (event) => {
    const msg = event.message || (event.error && event.error.message) || '';
    if (
      msg.includes('SecurityError') ||
      msg.includes('cross-origin frame') ||
      msg.includes('$$typeof')
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return false;
    }
  },
  true
);

window.onerror = function (msg) {
  if (
    typeof msg === 'string' &&
    (msg.includes('SecurityError') ||
      msg.includes('cross-origin frame'))
  ) {
    return true;
  }
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason &&
    (reason.name === 'SecurityError' ||
      (typeof reason?.message === 'string' &&
        (reason.message.includes('SecurityError') ||
          reason.message.includes('cross-origin frame') ||
          reason.message.includes('$$typeof'))))
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register service worker for offline availability
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration skipped:', err);
    });
  });
}



