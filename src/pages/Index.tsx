import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../types';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { toast } from 'sonner';
import { extractUsernameFromEmail, capitalizeStatus } from '../utils/userUtils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
const Index = () => {
  const {
    dialogs,
    isLoading,
    error,
    loadDialogs,
    deleteDialog
  } = useDatabaseDialogs();
  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);
  const handleDeleteDialog = async (dialogId: string, fileName: string) => {
    try {
      await deleteDialog(dialogId);
      toast.success(`Dialog "${fileName}" has been deleted successfully`);
    } catch (error) {
      console.error('Error deleting dialog:', error);
      toast.error('Failed to delete dialog');
    }
  };
  const getStatusColor = (status: Dialog['status']) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };
  if (isLoading && dialogs.length === 0) {
    return <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>;
  }
  return <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">VoiceQC Dashboard</h1>
        <p className="text-muted-foreground">
          Manage and analyze your voice recordings with AI-powered quality control
        </p>
      </div>

      {error && <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
            <Button onClick={loadDialogs} variant="outline" size="sm" className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>}

      {/* Dialog History */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog History</CardTitle>
          
        </CardHeader>
        <CardContent>
          {dialogs.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No dialogs transcribed yet</p>
              <p className="text-sm">Upload your first recording to get started</p>
            </div> : <div className="space-y-4">
              {dialogs.map(dialog => <div key={dialog.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{dialog.fileName}</h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>Supervisor: {extractUsernameFromEmail(dialog.assignedSupervisor)}</span>
                      <span>•</span>
                      <span>{new Date(dialog.uploadDate).toLocaleDateString()}</span>
                      {dialog.qualityScore && <>
                          <span>•</span>
                          <span>Quality: {dialog.qualityScore}%</span>
                        </>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(dialog.status)}`}>
                      {capitalizeStatus(dialog.status)}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/dialog/${dialog.id}`}>View Details</Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Dialog</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{dialog.fileName}"? This action cannot be undone and will permanently remove the dialog, transcription, and any analysis data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDialog(dialog.id, dialog.fileName)} className="bg-red-600 hover:bg-red-700">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>)}
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default Index;