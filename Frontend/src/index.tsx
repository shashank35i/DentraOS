import React from 'react';
import './index.css';
import { render } from 'react-dom';
import { AppRouter } from './AppRouter';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppointmentProvider } from './contexts/AppointmentContext';

render(
  <ThemeProvider>
    <AppointmentProvider>
      <AppRouter />
    </AppointmentProvider>
  </ThemeProvider>,
  document.getElementById('root')
);