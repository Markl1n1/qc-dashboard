
import React, { useState, useEffect } from 'react';
import { EmergencyLogger } from '../services/emergencyLogger';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export const EmergencyDebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(EmergencyLogger.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={() => setIsVisible(true)}
          variant="destructive"
          size="sm"
        >
          🚨 Debug Logs ({logs.length})
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Emergency Debug Logs</CardTitle>
            <div className="flex gap-1">
              <Button 
                onClick={() => EmergencyLogger.clear()}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
              <Button 
                onClick={() => setIsVisible(false)}
                variant="outline"
                size="sm"
              >
                Hide
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="max-h-64 overflow-y-auto text-xs font-mono space-y-1">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">No logs yet</div>
            ) : (
              logs.slice(-20).map((log, index) => (
                <div key={index} className="border-b border-border pb-1">
                  <div className="text-xs text-muted-foreground">
                    #{log.count} - {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="break-words">{log.message}</div>
                  {log.data && (
                    <div className="text-xs text-muted-foreground bg-muted p-1 rounded mt-1">
                      {log.data}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
