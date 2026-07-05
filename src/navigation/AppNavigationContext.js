import { createContext, useContext } from 'react';

export const AppNavigationContext = createContext({
  openLegacy: () => {},
  openInsights: () => {},
  openSettings: () => {},
  openDashboard: () => {},
  openCheckIn: () => {},
  openMyLife: () => {},
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}
