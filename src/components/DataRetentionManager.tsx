import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';

const DataRetentionManager = () => {
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [retentionDays, setRetentionDays] = useState(14);

  const runManualCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      const { data, error } = await supabase.functions.invoke('dialog-cleanup');
      
      if (error) throw error;
      
      toast.success(`Cleanup completed. Deleted ${data.deletedCount} dialogs older than ${data.retentionDays} days.`);
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast.error(error.message || 'Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const updateRetentionDays = async () => {
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({ key: 'data_retention_days', value: retentionDays.toString() }, { onConflict: 'key' });
      
      if (error) throw error;
      
      toast.success(`Data retention period updated to ${retentionDays} days`);
    } catch (error: any) {
      console.error('Error updating retention period:', error);
      toast.error(error.message || 'Failed to update retention period');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Retention Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="font-medium">Retention Period (days):</label>
          <input
            type="number"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-20 px-2 py-1 border rounded"
            min="1"
            max="365"
          />
          <Button onClick={updateRetentionDays} size="sm">
            Update
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={runManualCleanup} 
            disabled={isRunningCleanup}
            variant="outline"
          >
            {isRunningCleanup ? 'Running Cleanup...' : 'Run Manual Cleanup'}
          </Button>
          <span className="text-sm text-muted-foreground">
            This will delete all dialogs older than {retentionDays} days
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataRetentionManager;