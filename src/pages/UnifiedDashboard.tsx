
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useUserRole } from '../hooks/useUserRole';
import { Dialog } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SortOption = 'newest' | 'oldest' | 'name' | 'status';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

const UnifiedDashboard = () => {
  const navigate = useNavigate();
  const { dialogs, isLoading } = useDatabaseDialogs();
  const { isAdmin, isSupervisor } = useUserRole();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDialogs, setSelectedDialogs] = useState<string[]>([]);

  const stats = useMemo(() => {
    const total = dialogs.length;
    const pending = dialogs.filter(d => d.status === 'pending').length;
    const processing = dialogs.filter(d => d.status === 'processing').length;
    const completed = dialogs.filter(d => d.status === 'completed').length;
    const failed = dialogs.filter(d => d.status === 'failed').length;
    
    return { total, pending, processing, completed, failed };
  }, [dialogs]);

  const filteredAndSortedDialogs = useMemo(() => {
    let filtered = dialogs.filter(dialog => {
      const matchesSearch = dialog.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           dialog.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           dialog.assignedSupervisor.toLowerCase().includes(searchTerm.toLowerCase());
      
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
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleBulkAction = (action: string) => {
    console.log(`Performing ${action} on dialogs:`, selectedDialogs);
    // Implement bulk actions here
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Voice Quality Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and analyze voice recordings and transcriptions
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/upload')} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Recording
          </Button>
          {(isAdmin || isSupervisor) && (
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Settings
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
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
                <Input
                  placeholder="Search by filename, agent, or supervisor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
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

      {/* Bulk Actions */}
      {selectedDialogs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedDialogs.length} dialog(s) selected
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('reassign')}>
                  <Users className="h-4 w-4 mr-2" />
                  Reassign
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')}>
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog Records ({filteredAndSortedDialogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedDialogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No dialogs found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedDialogs.map((dialog) => (
                <div
                  key={dialog.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/dialog/${dialog.id}`)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedDialogs.includes(dialog.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          setSelectedDialogs([...selectedDialogs, dialog.id]);
                        } else {
                          setSelectedDialogs(selectedDialogs.filter(id => id !== dialog.id));
                        }
                      }}
                      className="rounded"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{dialog.fileName}</h3>
                        <Badge className={getStatusColor(dialog.status)}>
                          {getStatusIcon(dialog.status)}
                          <span className="ml-1 capitalize">{dialog.status}</span>
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <span>Agent: {dialog.assignedAgent}</span>
                        <span className="mx-2">•</span>
                        <span>Supervisor: {dialog.assignedSupervisor}</span>
                        <span className="mx-2">•</span>
                        <span>Uploaded: {new Date(dialog.uploadDate).toLocaleDateString()}</span>
                        {dialog.qualityScore && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Quality: {dialog.qualityScore}/100</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {dialog.tokenEstimation && (
                      <Badge variant="outline">
                        ${dialog.tokenEstimation.estimatedCost.toFixed(4)}
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
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

export default UnifiedDashboard;
