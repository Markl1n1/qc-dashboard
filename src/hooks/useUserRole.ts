
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../integrations/supabase/client';

export type UserRole = 'admin' | 'supervisor' | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    checkUserRole();
  }, [user]);

  const checkUserRole = async () => {
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } else {
        setRole(data?.role as UserRole || null);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = role === 'admin';
  const isSupervisor = role === 'supervisor' || role === 'admin';

  return {
    role,
    isAdmin,
    isSupervisor,
    isLoading,
    refetchRole: checkUserRole
  };
};
