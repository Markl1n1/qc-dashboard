
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileAudio, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Dialog } from '../types';

interface DialogStatsProps {
  dialogs: Dialog[];
}

const DialogStats: React.FC<DialogStatsProps> = ({ dialogs }) => {
  const stats = {
    total: dialogs.length,
    completed: dialogs.filter(d => d.status === 'completed').length,
    processing: dialogs.filter(d => d.status === 'processing').length,
    failed: dialogs.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Dialogs</CardTitle>
          <FileAudio className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completed}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Processing</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.processing}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.failed}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DialogStats;
