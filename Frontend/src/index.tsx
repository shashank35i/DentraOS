import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './AppRouter';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppointmentProvider } from './contexts/AppointmentContext';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found');
}

createRoot(rootEl).render(
  <ThemeProvider>
    <AppointmentProvider>
      <AppRouter />
    </AppointmentProvider>
  </ThemeProvider>
);
