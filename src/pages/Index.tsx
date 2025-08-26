import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Clock, 
  FileAudio, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Search,
  Calendar,
  User,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useAuthStore } from '../store/authStore';
import { useUserRole } from '../hooks/useUserRole';
import DialogFilters from '../components/DialogFilters';
import { format } from 'date-fns';

const Index = () => {
  const { user } = useAuthStore();
  const { isAdmin, isSupervisor } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');

  const {
    dialogs,
    isLoading,
    error,
    refetch
  } = useDatabaseDialogs(isAdmin ? undefined : user?.id);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'processing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Filter dialogs based on search and filters
  const filteredDialogs = dialogs.filter(dialog => {
    const matchesSearch = dialog.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dialog.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dialog.assignedSupervisor.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || dialog.status === statusFilter;
    const matchesAgent = agentFilter === 'all' || dialog.assignedAgent === agentFilter;
    const matchesSupervisor = supervisorFilter === 'all' || dialog.assignedSupervisor === supervisorFilter;
    
    return matchesSearch && matchesStatus && matchesAgent && matchesSupervisor;
  });

  // Get unique values for filters
  const uniqueAgents = [...new Set(dialogs.map(d => d.assignedAgent))];
  const uniqueSupervisors = [...new Set(dialogs.map(d => d.assignedSupervisor))];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading dialogs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Dialogs</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refetch}>Try Again</Button>
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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and review your dialog transcriptions and evaluations
          </p>
        </div>
        <Button asChild>
          <Link to="/upload">
            <FileAudio className="mr-2 h-4 w-4" />
            Upload Audio
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dialogs</CardTitle>
            <FileAudio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dialogs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dialogs.filter(d => d.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Loader2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dialogs.filter(d => d.status === 'processing').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dialogs.filter(d => d.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Dialog History</CardTitle>
          <CardDescription>
            View and manage all dialog transcriptions and evaluations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search dialogs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <DialogFilters
              statusFilter={statusFilter}
              agentFilter={agentFilter}
              supervisorFilter={supervisorFilter}
              onStatusChange={setStatusFilter}
              onAgentChange={setAgentFilter}
              onSupervisorChange={setSupervisorFilter}
              uniqueAgents={uniqueAgents}
              uniqueSupervisors={uniqueSupervisors}
            />
          </div>

          {/* Dialogs List */}
          <div className="space-y-3">
            {filteredDialogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No dialogs found matching your criteria.
              </div>
            ) : (
              filteredDialogs.map((dialog) => (
                <Card key={dialog.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      {/* Left side - File info and status */}
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(dialog.status)}
                          <Badge variant={getStatusBadgeVariant(dialog.status)} className="text-xs">
                            {dialog.status}
                          </Badge>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{dialog.fileName}</h3>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(dialog.uploadDate), 'MMM dd, yyyy')}</span>
                            </div>
                            {dialog.tokenEstimation?.audioLengthMinutes && (
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>{dialog.tokenEstimation.audioLengthMinutes.toFixed(1)} min</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle - Agent and Supervisor info */}
                      <div className="hidden md:flex items-center space-x-6 px-4">
                        <div className="text-center">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-1">
                            <User className="h-3 w-3" />
                            <span>Agent</span>
                          </div>
                          <div className="text-sm font-medium">{dialog.assignedAgent}</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            <span>Supervisor</span>
                          </div>
                          <div className="text-sm font-medium">{dialog.assignedSupervisor}</div>
                        </div>
                      </div>

                      {/* Right side - Actions */}
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/dialog/${dialog.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Mobile view for agent/supervisor info */}
                    <div className="md:hidden mt-3 pt-3 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="text-muted-foreground">Agent: </span>
                          <span className="font-medium">{dialog.assignedAgent}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Supervisor: </span>
                          <span className="font-medium">{dialog.assignedSupervisor}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
