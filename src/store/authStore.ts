import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, passcode: string) => Promise<{ success: boolean; error?: string; emailConfirmationRequired?: boolean }>;
  logout: () => Promise<void>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  updatePasscode: (newPasscode: string) => Promise<{ success: boolean; error?: string }>;
  getCurrentPasscode: () => Promise<string | null>;
  setAuth: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
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

      initializeAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          get().setAuth(session);

          // Listen for auth changes
          supabase.auth.onAuthStateChange((_event, session) => {
            get().setAuth(session);
          });
        } catch (error) {
          console.error('Error initializing auth:', error);
        }
      },

      login: async (email: string, password: string) => {
        try {
          console.log('Security Event: Login attempt for email:', email.substring(0, 3) + '***');
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.log('Security Event: Failed login attempt for email:', email.substring(0, 3) + '***', 'Error:', error.message);
            
            // Parse specific error messages
            let userFriendlyMessage = error.message;
            if (error.message.includes('Invalid login credentials')) {
              userFriendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (error.message.includes('Email not confirmed')) {
              userFriendlyMessage = 'Please check your email and click the confirmation link before logging in.';
            } else if (error.message.includes('Too many requests')) {
              userFriendlyMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
            } else if (error.message.includes('User not found')) {
              userFriendlyMessage = 'No account found with this email address. Please check your email or sign up.';
            }
            
            return { success: false, error: userFriendlyMessage };
          }

          if (data.session) {
            get().setAuth(data.session);
            console.log('Security Event: Successful login for user:', data.session.user.email?.substring(0, 3) + '***');
            return { success: true };
          }

          return { success: false, error: 'Login failed. Please try again.' };
        } catch (error) {
          console.error('Security Event: Login error:', error);
          return { success: false, error: 'An unexpected error occurred during login. Please try again.' };
        }
      },

      signUp: async (email: string, password: string, name: string, passcode: string) => {
        try {
          console.log('Security Event: Sign up attempt for email:', email.substring(0, 3) + '***');
          
          // First verify the passcode
          const isPasscodeValid = await get().verifyPasscode(passcode);
          if (!isPasscodeValid) {
            console.log('Security Event: Invalid passcode used during signup attempt for email:', email.substring(0, 3) + '***');
            return { success: false, error: 'Invalid passcode. Please contact your administrator for the correct passcode.' };
          }

          // Use email-confirmed page as redirect URL for email confirmation
          const redirectUrl = `${window.location.origin}/email-confirmed`;
          
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
            console.log('Security Event: Sign up failed for email:', email.substring(0, 3) + '***', 'Error:', error.message);
            
            // Parse specific error messages
            let userFriendlyMessage = error.message;
            if (error.message.includes('User already registered')) {
              userFriendlyMessage = 'An account with this email already exists. Please try logging in instead.';
            } else if (error.message.includes('Password should be at least')) {
              userFriendlyMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.message.includes('Invalid email')) {
              userFriendlyMessage = 'Please enter a valid email address.';
            } else if (error.message.includes('Email rate limit exceeded')) {
              userFriendlyMessage = 'Too many signup attempts. Please wait a few minutes before trying again.';
            }
            
            return { success: false, error: userFriendlyMessage };
          }

          if (data.session) {
            get().setAuth(data.session);
            console.log('Security Event: Successful sign up for email:', email.substring(0, 3) + '***');
            return { success: true, emailConfirmationRequired: false };
          }

          // Email confirmation required
          console.log('Security Event: Sign up successful, email confirmation required for:', email.substring(0, 3) + '***');
          return { success: true, emailConfirmationRequired: true };
        } catch (error) {
          console.error('Security Event: Sign up error:', error);
          return { success: false, error: 'An unexpected error occurred during registration. Please try again.' };
        }
      },

      verifyPasscode: async (passcode: string) => {
        try {
          console.log('Security Event: Passcode verification request initiated');
          
      // Use secure edge function for passcode verification
      const { data, error } = await supabase.functions.invoke('verify-passcode', {
        body: { passcode }
      });

          if (error) {
            console.error('Security Event: Error calling passcode verification function:', error.message);
            return false;
          }

          if (!data) {
            console.error('Security Event: No response from passcode verification function');
            return false;
          }

          const isValid = data.valid === true;
          if (!isValid) {
            console.log('Security Event: Invalid passcode verification attempt');
          } else {
            console.log('Security Event: Successful passcode verification');
          }

          return isValid;
        } catch (error) {
          console.error('Security Event: Error verifying passcode:', error);
          return false;
        }
      },

      updatePasscode: async (newPasscode: string) => {
        try {
          const currentUser = get().user;
          console.log('Security Event: Passcode update attempt by user:', currentUser?.email?.substring(0, 3) + '***');
          
          const { error } = await supabase
            .from('system_config')
            .update({ 
              value: newPasscode,
              updated_at: new Date().toISOString()
            })
            .eq('key', 'signup_passcode');

          if (error) {
            console.error('Security Event: Failed to update passcode:', error.message);
            return { success: false, error: error.message };
          }

          console.log('Security Event: Passcode successfully updated by admin user:', currentUser?.email?.substring(0, 3) + '***');
          return { success: true };
        } catch (error) {
          console.error('Security Event: Error updating passcode:', error);
          return { success: false, error: 'Failed to update passcode. Admin access required.' };
        }
      },

      getCurrentPasscode: async () => {
        try {
          const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'signup_passcode')
            .single();

          if (error) {
            console.error('Security Event: Error fetching current passcode:', error.message);
            return null;
          }

          if (!data) {
            console.error('Security Event: No current passcode found');
            return null;
          }

          return data.value;
        } catch (error) {
          console.error('Security Event: Error retrieving current passcode:', error);
          return null;
        }
      },

      logout: async () => {
        try {
          const currentUser = get().user;
          console.log('Security Event: Logout initiated by user:', currentUser?.email?.substring(0, 3) + '***');
          
          await supabase.auth.signOut();
          set({ user: null, session: null, isAuthenticated: false });
          
          console.log('Security Event: Successful logout');
        } catch (error) {
          console.error('Security Event: Error logging out:', error);
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
