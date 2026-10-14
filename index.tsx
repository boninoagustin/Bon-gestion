import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { logError } from './lib/errorLogger';

// Fallback seguro para crypto.randomUUID en contextos no seguros (HTTP o WebViews de Capacitor/Electron)
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    // @ts-ignore
    window.crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

// Global error handlers for uncaught errors
window.addEventListener('error', (event) => {
  logError(event.error || new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  logError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW registration failed silently
    });
  });
}