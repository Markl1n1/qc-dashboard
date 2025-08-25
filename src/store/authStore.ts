
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Mock supervisor credentials
const MOCK_SUPERVISORS: Record<string, User> = {
  'supervisor@callcenter.com': {
    id: '1',
    email: 'supervisor@callcenter.com',
    name: 'John Supervisor',
    role: 'supervisor',
  },
  'admin@callcenter.com': {
    id: '2',
    email: 'admin@callcenter.com',
    name: 'Admin User',
    role: 'supervisor',
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, password: string) => {
        // Mock authentication - in real app this would be an API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const user = MOCK_SUPERVISORS[email];
        if (user && password === 'password123') {
          set({ user, isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
