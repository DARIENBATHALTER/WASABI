import { useEffect } from 'react';
import { useStore } from '../store';

export const useAuth = () => {
  const { currentUser, isSessionValid, logout } = useStore();

  useEffect(() => {
    // Check session validity on mount and when currentUser changes
    if (currentUser && !isSessionValid()) {
      console.log('Session expired, logging out...');
      logout();
    }
  }, [currentUser, isSessionValid, logout]);

  return {
    isAuthenticated: !!currentUser && isSessionValid(),
    user: currentUser,
    logout
  };
};