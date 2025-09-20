import { supabase } from '../integrations/supabase/client';

// Enhanced database service with caching and optimization
class OptimizedDatabaseService {
  private queryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

  // Connection pool simulation for better performance
  private pendingQueries = new Map<string, Promise<any>>();

  private getCacheKey(query: string, params?: any): string {
    return `${query}-${JSON.stringify(params || {})}`;
  }

  private getCachedData(cacheKey: string): any | null {
    const cached = this.queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    this.queryCache.delete(cacheKey);
    return null;
  }

  private setCachedData(cacheKey: string, data: any): void {
    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Deduplicate concurrent queries
  private async executeQuery<T>(queryKey: string, queryFn: () => Promise<T>): Promise<T> {
    if (this.pendingQueries.has(queryKey)) {
      return this.pendingQueries.get(queryKey) as Promise<T>;
    }

    const promise = queryFn();
    this.pendingQueries.set(queryKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingQueries.delete(queryKey);
    }
  }

  // Optimized user queries with caching
  async getUsers(useCache = true): Promise<any[]> {
    const cacheKey = this.getCacheKey('users');
    
    if (useCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    return this.executeQuery('users', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const result = data || [];
      this.setCachedData(cacheKey, result);
      return result;
    });
  }

  // Optimized system config with caching
  async getSystemConfig(useCache = true): Promise<any[]> {
    const cacheKey = this.getCacheKey('system_config');
    
    if (useCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    return this.executeQuery('system_config', async () => {
      const { data, error } = await supabase
        .from('system_config')
        .select('key, value, description')
        .order('key');

      if (error) throw error;

      const result = data || [];
      this.setCachedData(cacheKey, result);
      return result;
    });
  }

  // Batch operations for better performance
  async batchUpdateUsers(updates: Array<{ id: string; role?: string; name?: string }>): Promise<void> {
    // Use the admin operations edge function for service role access
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: {
        operation: 'batch_user_update',
        data: { updates }
      }
    });

    if (error) throw error;

    // Clear cache after updates
    this.clearCache('users');
  }

  // Optimized dialog queries with pagination
  async getDialogsPaginated(
    page = 1, 
    limit = 20, 
    filters?: { status?: string; agent?: string }
  ): Promise<{ data: any[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * limit;
    const cacheKey = this.getCacheKey('dialogs_paginated', { page, limit, filters });
    
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    return this.executeQuery(`dialogs_${page}_${limit}`, async () => {
      let query = supabase
        .from('dialogs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.agent) {
        query = query.eq('assigned_agent', filters.agent);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const result = {
        data: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

      this.setCachedData(cacheKey, result);
      return result;
    });
  }

  // Bulk delete operations
  async bulkDeleteDialogs(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // Use chunks for large deletions
    const chunks = this.chunkArray(ids, 100);
    
    for (const chunk of chunks) {
      const { error } = await supabase
        .from('dialogs')
        .delete()
        .in('id', chunk);

      if (error) throw error;
    }

    // Clear related caches
    this.clearCache('dialogs');
  }

  // Utility methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }

  // Connection health check
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('key')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  // Analytics and monitoring
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys())
    };
  }

  // Performance monitoring
  async measureQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await queryFn();
      const duration = performance.now() - start;
      console.log(`Query ${name} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`Query ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}

export const optimizedDatabaseService = new OptimizedDatabaseService();