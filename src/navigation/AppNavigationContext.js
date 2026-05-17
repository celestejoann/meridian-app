import { createContext, useContext } from 'react';

export const AppNavigationContext = createContext({
  openLegacy: () => {},
  openInsights: () => {},
  openSettings: () => {},
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}
