import React from 'react';
import { AppDataProvider } from './state/AppDataContext.jsx';
import { ToastProvider, ConfirmProvider } from './components/ui/index.js';
import Shell from './Shell.jsx';

// Casey Rides. All data and data actions live in AppDataContext; the Shell draws the four
// tabs (Today, Rides, Progress, Settings) and pages. See ARCHITECTURE.md.
export default function App() {
  return (
    <AppDataProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Shell />
        </ConfirmProvider>
      </ToastProvider>
    </AppDataProvider>
  );
}
