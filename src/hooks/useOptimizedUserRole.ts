import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../integrations/supabase/client';

export type UserRole = 'admin' | 'supervisor' | null;

interface RoleCache {
  role: UserRole;
  timestamp: number;
}

// Cache user roles for 5 minutes to reduce database calls
const roleCache = new Map<string, RoleCache>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useOptimizedUserRole = () => {
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

    // Check cache first
    const cached = roleCache.get(user.id);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setRole(cached.role);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid errors if no profile exists

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } else {
        const userRole = (data?.role as UserRole) || 'supervisor'; // Default to supervisor
        setRole(userRole);
        
        // Cache the result
        roleCache.set(user.id, {
          role: userRole,
          timestamp: now
        });
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearRoleCache = (userId?: string) => {
    if (userId) {
      roleCache.delete(userId);
    } else {
      roleCache.clear();
    }
  };

  const isAdmin = role === 'admin';
  const isSupervisor = role === 'supervisor' || role === 'admin';

  return {
    role,
    isAdmin,
    isSupervisor,
    isLoading,
    refetchRole: checkUserRole,
    clearRoleCache
  };
};