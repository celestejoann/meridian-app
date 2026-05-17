import { createContext, useContext } from 'react';

export const AppNavigationContext = createContext({
  openLegacy: () => {},
  openSettings: () => {},
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}
