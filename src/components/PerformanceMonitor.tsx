import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Activity, Database, Server, RefreshCw } from 'lucide-react';
import { optimizedDatabaseService } from '../services/optimizedDatabaseService';
import { toast } from 'sonner';

interface PerformanceMetrics {
  cacheSize: number;
  cacheKeys: string[];
  dbHealth: boolean;
  lastUpdate: number;
}

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cacheSize: 0,
    cacheKeys: [],
    dbHealth: false,
    lastUpdate: Date.now()
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const cacheStats = optimizedDatabaseService.getCacheStats();
      const dbHealth = await optimizedDatabaseService.healthCheck();
      
      setMetrics({
        cacheSize: cacheStats.size,
        cacheKeys: cacheStats.keys,
        dbHealth,
        lastUpdate: Date.now()
      });
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  const clearCache = async () => {
    setIsLoading(true);
    try {
      optimizedDatabaseService.clearCache();
      await loadMetrics();
      toast.success('Cache cleared successfully');
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setIsLoading(false);
    }
  };

  const formatLastUpdate = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Monitor
        </CardTitle>
        <CardDescription>
          System performance metrics and cache status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Database Health</span>
            </div>
            <Badge variant={metrics.dbHealth ? 'default' : 'destructive'}>
              {metrics.dbHealth ? 'Healthy' : 'Unhealthy'}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">Cache Size</span>
            </div>
            <div className="text-2xl font-bold">{metrics.cacheSize}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.cacheKeys.length} cached queries
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm font-medium">Last Update</span>
            </div>
            <div className="text-sm">
              {formatLastUpdate(metrics.lastUpdate)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={isLoading}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearCache}
            disabled={isLoading}
          >
            Clear Cache
          </Button>
        </div>

        {metrics.cacheKeys.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Cached Queries</h4>
            <div className="flex flex-wrap gap-1">
              {metrics.cacheKeys.slice(0, 10).map((key, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {key.split('-')[0]}
                </Badge>
              ))}
              {metrics.cacheKeys.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{metrics.cacheKeys.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;