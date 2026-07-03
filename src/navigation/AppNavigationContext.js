import { createContext, useContext } from 'react';

export const AppNavigationContext = createContext({
  openLegacy: () => {},
  openInsights: () => {},
  openSettings: () => {},
  openDashboard: () => {},
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}
