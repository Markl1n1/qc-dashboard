
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../integrations/supabase/client';

export type Theme = 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadUserTheme();
  }, [user]);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const loadUserTheme = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        setTheme(data.theme as Theme || 'light');
      }
    } catch (error) {
      console.error('Error loading user theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTheme = async (newTheme: Theme) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', user.id);

      if (!error) {
        setTheme(newTheme);
      }
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  return {
    theme,
    setTheme: updateTheme,
    isLoading
  };
};
