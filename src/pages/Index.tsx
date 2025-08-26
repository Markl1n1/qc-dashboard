
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Calendar, FileAudio, Users, BarChart3, Filter, Upload, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialogStore } from '../store/dialogStore';
import { Dialog } from '../types';
import { toast } from 'sonner';
import DialogFilters from '../components/DialogFilters';
import DialogStats from '../components/DialogStats';

const Index = () => {
  const { 
    dialogs, 
    isLoading, 
    error, 
    loadDialogs, 
    deleteDialog,
    clearDialogs 
  } = useDialogStore();
  
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const filteredDialogs = dialogs.filter(dialog => 
    statusFilter === 'all' || dialog.status === statusFilter
  );

  const handleDeleteDialog = async (id: string) => {
    try {
      await deleteDialog(id);
      toast.success('Dialog deleted successfully');
    } catch (error) {
      toast.error('Failed to delete dialog');
    }
  };

  const handleClearAllDialogs = async () => {
    if (window.confirm('Are you sure you want to delete all dialogs? This action cannot be undone.')) {
      try {
        clearDialogs();
        toast.success('All dialogs cleared successfully');
      } catch (error) {
        toast.error('Failed to clear dialogs');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    // Capitalize first letter of status
    const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
    
    const variants = {
      'pending': 'default',
      'processing': 'secondary', 
      'completed': 'default',
      'error': 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {capitalizedStatus}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading dialogs...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dialog Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Analyze and manage your call center conversations
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/upload">
            <Button className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Dialog
            </Button>
          </Link>
          {dialogs.length > 0 && (
            <Button 
              variant="outline"
              onClick={handleClearAllDialogs}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <DialogStats dialogs={dialogs} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DialogFilters
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </CardContent>
      </Card>

      {/* Dialogs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Recent Dialogs ({filteredDialogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDialogs.length === 0 ? (
            <div className="text-center py-12">
              <FileAudio className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No dialogs found</h3>
              <p className="text-muted-foreground mb-4">
                {statusFilter === 'all' 
                  ? "Upload your first audio file to get started with dialog analysis."
                  : `No dialogs found with status "${statusFilter}".`
                }
              </p>
              <Link to="/upload">
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Dialog
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDialogs.map((dialog: Dialog) => (
                <div key={dialog.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left side - File info with improved vertical alignment */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex-shrink-0">
                        <FileAudio className="h-8 w-8 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{dialog.audioFileName}</h3>
                          {getStatusBadge(dialog.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{formatDate(dialog.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{dialog.assignedAgent}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right side - Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link to={`/dialog/${dialog.id}`}>
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          View Analysis
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDialog(dialog.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
