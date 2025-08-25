
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  updatePasscode: (newPasscode: string) => Promise<{ success: boolean; error?: string }>;
  getCurrentPasscode: () => Promise<string | null>;
  setAuth: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,

      setAuth: (session: Session | null) => {
        set({
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
        });
      },

      login: async (email: string, password: string) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            return { success: false, error: error.message };
          }

          if (data.session) {
            get().setAuth(data.session);
            return { success: true };
          }

          return { success: false, error: 'Login failed' };
        } catch (error) {
          return { success: false, error: 'An unexpected error occurred' };
        }
      },

      signUp: async (email: string, password: string, name: string, passcode: string) => {
        try {
          // First verify the passcode
          const isPasscodeValid = await get().verifyPasscode(passcode);
          if (!isPasscodeValid) {
            return { success: false, error: 'Passcode incorrect, request your passcode' };
          }

          const redirectUrl = `${window.location.origin}/`;
          
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectUrl,
              data: {
                name: name,
              }
            }
          });

          if (error) {
            return { success: false, error: error.message };
          }

          if (data.session) {
            get().setAuth(data.session);
          }

          return { success: true };
        } catch (error) {
          return { success: false, error: 'An unexpected error occurred' };
        }
      },

      verifyPasscode: async (passcode: string) => {
        try {
          const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'signup_passcode')
            .single();

          if (error || !data) {
            console.error('Error fetching passcode:', error);
            return false;
          }

          return data.value === passcode;
        } catch (error) {
          console.error('Error verifying passcode:', error);
          return false;
        }
      },

      updatePasscode: async (newPasscode: string) => {
        try {
          const { error } = await supabase
            .from('system_config')
            .update({ 
              value: newPasscode,
              updated_at: new Date().toISOString()
            })
            .eq('key', 'signup_passcode');

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true };
        } catch (error) {
          return { success: false, error: 'Failed to update passcode' };
        }
      },

      getCurrentPasscode: async () => {
        try {
          const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'signup_passcode')
            .single();

          if (error || !data) {
            return null;
          }

          return data.value;
        } catch (error) {
          return null;
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut();
          set({ user: null, session: null, isAuthenticated: false });
        } catch (error) {
          console.error('Error logging out:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
