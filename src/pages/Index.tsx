
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Clock, FileText, User, Play, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import DialogFilters from '@/components/DialogFilters';
import { Dialog } from '@/types';
import { useDatabaseDialogs } from '@/hooks/useDatabaseDialogs';
import { format } from 'date-fns';

const Index = () => {
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'newest' as const,
    status: 'all' as const
  });
  const [filteredDialogs, setFilteredDialogs] = useState<Dialog[]>([]);

  const { dialogs, isLoading, error, loadDialogs } = useDatabaseDialogs();

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  useEffect(() => {
    let filtered = [...dialogs];

    // Apply search filter
    if (filters.search) {
      filtered = filtered.filter(dialog =>
        dialog.fileName.toLowerCase().includes(filters.search.toLowerCase()) ||
        dialog.transcription?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status === 'processed') {
      filtered = filtered.filter(dialog => 
        dialog.transcription && dialog.transcription.length > 0
      );
    } else if (filters.status === 'pending') {
      filtered = filtered.filter(dialog => 
        !dialog.transcription || dialog.transcription.length === 0
      );
    }
    // If filters.status === 'all', don't filter by status

    // Apply sorting
    filtered.sort((a, b) => {
      if (filters.sortBy === 'newest') {
        return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      } else if (filters.sortBy === 'oldest') {
        return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
      } else if (filters.sortBy === 'filename') {
        return a.fileName.localeCompare(b.fileName);
      }
      return 0;
    });

    setFilteredDialogs(filtered);
  }, [dialogs, filters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dialogs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Dialogs</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadDialogs}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dialog History</h1>
          <p className="text-muted-foreground">
            View and analyze your uploaded voice dialogs
          </p>
        </div>
        <Link to="/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Upload New Dialog
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <DialogFilters 
        searchTerm={filters.search}
        onSearchChange={(search) => setFilters(prev => ({ ...prev, search }))}
        sortBy={filters.sortBy}
        onSortChange={(sortBy) => setFilters(prev => ({ ...prev, sortBy }))}
        statusFilter={filters.status}
        onStatusChange={(status) => setFilters(prev => ({ ...prev, status }))}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dialogs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dialogs.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dialogs.filter(d => d.transcription && d.transcription.length > 0).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dialogs.filter(d => !d.transcription || d.transcription.length === 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Dialogs ({filteredDialogs.length})</CardTitle>
          <CardDescription>
            Click on any dialog to view details and analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDialogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No dialogs found</h3>
              <p className="text-muted-foreground mb-4">
                {dialogs.length === 0 
                  ? "Get started by uploading your first voice dialog."
                  : "Try adjusting your filters to see more results."
                }
              </p>
              {dialogs.length === 0 && (
                <Link to="/upload">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload Your First Dialog
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredDialogs.map((dialog, index) => (
                <Link 
                  key={dialog.id} 
                  to={`/dialog/${dialog.id}`}
                  className="block p-6 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{dialog.fileName}</h3>
                        <Badge variant={dialog.transcription && dialog.transcription.length > 0 ? "default" : "secondary"}>
                          {dialog.transcription && dialog.transcription.length > 0 ? "Processed" : "Pending"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {format(new Date(dialog.uploadDate), 'MMM d, yyyy HH:mm')}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{dialog.assignedAgent}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
