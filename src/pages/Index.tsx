
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileAudio, Download, Eye, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useDatabaseDialogs } from '@/hooks/useDatabaseDialogs';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import DialogFilters from '@/components/DialogFilters';

interface Dialog {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  duration?: number;
  audio_url?: string;
}

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [filters, setFilters] = useState({
    searchTerm: '',
    statusFilter: 'all',
    sortBy: 'date'
  });

  const navigate = useNavigate();
  const { dialogs: hookDialogs, isLoading, error: hookError, loadDialogs } = useDatabaseDialogs();

  useEffect(() => {
    handleLoadDialogs();
  }, []);

  const handleLoadDialogs = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadDialogs();
      setDialogs(hookDialogs);
      setError(hookError);
    } catch (err) {
      setError('Failed to load dialogs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDialogs = dialogs.filter((dialog) => {
    const statusFilter = filters.statusFilter === 'all' || dialog.status.toLowerCase() === filters.statusFilter.toLowerCase();
    const searchFilter = !filters.searchTerm ||
      dialog.filename.toLowerCase().includes(filters.searchTerm.toLowerCase());

    return statusFilter && searchFilter;
  });

  const handleRefresh = () => {
    handleLoadDialogs();
  };

  const handleView = (dialog: Dialog) => {
    navigate(`/dialog/${dialog.id}`);
  };

  const handleDownload = (dialog: Dialog) => {
    if (dialog.audio_url) {
      const link = document.createElement('a');
      link.href = dialog.audio_url;
      link.download = dialog.filename || 'audio.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error('Audio file not available for download.');
    }
  };

  const handleDelete = async (dialogId: string) => {
    if (window.confirm('Are you sure you want to delete this dialog?')) {
      try {
        // Optimistically update the UI
        setDialogs(prevDialogs => prevDialogs.filter(dialog => dialog.id !== dialogId));

        // Call the Supabase function to delete the dialog
        const response = await fetch(`/api/delete-dialog?id=${dialogId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // If the deletion failed, revert the UI update
          handleLoadDialogs();
          const errorData = await response.json();
          toast.error(`Failed to delete dialog: ${errorData.message || response.statusText}`);
        } else {
          toast.success('Dialog deleted successfully.');
        }
      } catch (error: any) {
        // If the deletion failed, revert the UI update
        handleLoadDialogs();
        toast.error(`Failed to delete dialog: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const capitalizeStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  if (loading || isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading dialogs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Dialog History</h1>
        <Button onClick={handleRefresh} variant="outline">
          Refresh
        </Button>
      </div>

      <DialogFilters
        searchTerm={filters.searchTerm}
        onSearchChange={(value) => setFilters({ ...filters, searchTerm: value })}
        statusFilter={filters.statusFilter}
        onStatusChange={(value) => setFilters({ ...filters, statusFilter: value })}
        sortBy={filters.sortBy}
        onSortChange={(value) => setFilters({ ...filters, sortBy: value })}
      />

      {filteredDialogs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileAudio className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No dialogs found</h3>
            <p className="text-muted-foreground mb-4">
              {dialogs.length === 0
                ? "Upload your first audio file to get started"
                : "No dialogs match your current filters"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDialogs.map((dialog) => (
            <Card key={dialog.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Left side - File info with proper vertical centering */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex-shrink-0 flex items-center">
                      <FileAudio className="h-8 w-8 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">{dialog.filename}</h3>
                        <Badge variant={getStatusBadgeVariant(dialog.status)}>
                          {capitalizeStatus(dialog.status)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDistanceToNow(new Date(dialog.created_at), { addSuffix: true })}</span>
                        </div>

                        {dialog.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{Math.round(dialog.duration)}s</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side - Actions with proper vertical centering */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(dialog)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {dialog.audio_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(dialog)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(dialog.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;
