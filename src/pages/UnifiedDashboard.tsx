import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Filter, Upload, BarChart3, Clock, CheckCircle, AlertCircle, FileText, TrendingUp, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useUserRole } from '../hooks/useUserRole';
import { Dialog } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import GenerateReportDialog from '@/components/GenerateReportDialog';
import OptimizedDialogCard from '@/components/OptimizedDialogCard';
import SkeletonLoader from '@/components/SkeletonLoader';
type SortOption = 'newest' | 'oldest' | 'name' | 'status';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';
const UnifiedDashboard = () => {
  const navigate = useNavigate();
  const {
    dialogs,
    isLoading,
    deleteDialog
  } = useDatabaseDialogs();
  const {
    isAdmin,
    isSupervisor
  } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const stats = useMemo(() => {
    const total = dialogs.length;
    const pending = dialogs.filter(d => d.status === 'pending').length;
    const processing = dialogs.filter(d => d.status === 'processing').length;
    const completed = dialogs.filter(d => d.status === 'completed').length;
    const failed = dialogs.filter(d => d.status === 'failed').length;
    return {
      total,
      pending,
      processing,
      completed,
      failed
    };
  }, [dialogs]);
  const filteredAndSortedDialogs = useMemo(() => {
    let filtered = dialogs.filter(dialog => {
      const matchesSearch = dialog.fileName.toLowerCase().includes(searchTerm.toLowerCase()) || dialog.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase()) || dialog.assignedSupervisor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || dialog.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        case 'oldest':
          return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
        case 'name':
          return a.fileName.localeCompare(b.fileName);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [dialogs, searchTerm, sortBy, statusFilter]);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };
  const handleDeleteDialog = async (dialogId: string) => {
    try {
      await deleteDialog(dialogId);
      toast.success('Dialog deleted successfully');
    } catch (error) {
      console.error('Error deleting dialog:', error);
      toast.error('Failed to delete dialog');
    }
  };
  if (isLoading) {
    return <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {Array.from({
          length: 4
        }).map((_, i) => <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-8 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>)}
        </div>

        {/* Filters Skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
              <div className="h-10 w-[150px] bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Dialog Cards Skeleton */}
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <SkeletonLoader count={6} />
            </div>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quality Control Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <GenerateReportDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by filename, agent, or supervisor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog Records ({filteredAndSortedDialogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedDialogs.length === 0 ? <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No dialogs found matching your criteria</p>
            </div> : <div className="space-y-2">
              {filteredAndSortedDialogs.map(dialog => <div key={dialog.id}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium truncate">{dialog.fileName}</h3>
                          <Badge className={getStatusColor(dialog.status)}>
                            {getStatusIcon(dialog.status)}
                            <span className="ml-1 capitalize">{dialog.status}</span>
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(dialog.uploadDate).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>Supervisor: {dialog.assignedSupervisor}</span>
                          {dialog.qualityScore && <>
                              <span className="hidden sm:inline">•</span>
                              <span>{dialog.qualityScore}/100</span>
                            </>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dialog/${dialog.id}`)}>
                        View Details
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Dialog</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{dialog.fileName}"? This action cannot be undone and will remove all associated transcriptions and analyses.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteDialog(dialog.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>)}
            </div>}
        </CardContent>
      </Card>
    </div>;
};
export default UnifiedDashboard;