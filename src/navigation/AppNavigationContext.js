import { createContext, useContext } from 'react';

export const AppNavigationContext = createContext({
  openLegacy: () => {},
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}
