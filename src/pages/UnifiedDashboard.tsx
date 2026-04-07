import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Filter, Upload, BarChart3, Clock, CheckCircle, AlertCircle, FileText, TrendingUp, Trash2, Loader2, ChevronLeft, ChevronRight, RotateCcw, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';
import { useUserRole } from '../hooks/useUserRole';
import { Dialog } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import GenerateReportDialog from '@/components/GenerateReportDialog';
import SkeletonLoader from '@/components/SkeletonLoader';
import RetryTranscriptionDialog from '@/components/RetryTranscriptionDialog';
import { useTranslation } from '../i18n';

const ITEMS_PER_PAGE = 20;
type SortOption = 'newest' | 'oldest' | 'name' | 'status';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

const UnifiedDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dialogs, isLoading, deleteDialog, loadDialogs } = useDatabaseDialogs();
  const { isAdmin, isSupervisor } = useUserRole();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryDialog, setRetryDialog] = useState<Dialog | null>(null);
  const [isRetryDialogOpen, setIsRetryDialogOpen] = useState(false);

  // Unique agents for filter
  const uniqueAgents = useMemo(() => {
    const agents = new Set(dialogs.map(d => d.assignedAgent).filter(Boolean));
    return Array.from(agents).sort();
  }, [dialogs]);

  // Summary stats
  const stats = useMemo(() => {
    const total = dialogs.length;
    const completed = dialogs.filter(d => d.status === 'completed').length;
    const failed = dialogs.filter(d => d.status === 'failed').length;
    const scores = dialogs.filter(d => d.qualityScore).map(d => d.qualityScore!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { total, completed, failed, avgScore };
  }, [dialogs]);

  const filteredAndSortedDialogs = useMemo(() => {
    let filtered = dialogs.filter(dialog => {
      const matchesSearch = dialog.fileName.toLowerCase().includes(searchTerm.toLowerCase()) || dialog.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase()) || dialog.assignedSupervisor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || dialog.status === statusFilter;
      const matchesAgent = agentFilter === 'all' || dialog.assignedAgent === agentFilter;
      return matchesSearch && matchesStatus && matchesAgent;
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        case 'oldest': return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
        case 'name': return a.fileName.localeCompare(b.fileName);
        case 'status': return a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [dialogs, searchTerm, sortBy, statusFilter, agentFilter]);

  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy, statusFilter, agentFilter]);

  const totalPages = Math.ceil(filteredAndSortedDialogs.length / ITEMS_PER_PAGE);
  const paginatedDialogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedDialogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedDialogs, currentPage]);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return t('dashboard.completed');
      case 'processing': return t('dashboard.processing');
      case 'pending': return t('dashboard.pending');
      case 'failed': return t('dashboard.failed');
      default: return status;
    }
  };

  const handleDeleteDialog = async (dialogId: string) => {
    try { await deleteDialog(dialogId); toast.success(t('dashboard.dialogDeleted')); }
    catch (error) { console.error('Error deleting dialog:', error); toast.error(t('dashboard.deleteError')); }
  };

  const handleRetryDialog = (dialog: Dialog) => { setRetryDialog(dialog); setIsRetryDialogOpen(true); };
  const handleRetrySuccess = () => { loadDialogs(); };

  if (isLoading) {
    return <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><div className="flex items-center justify-between"><div className="space-y-2"><div className="h-4 w-16 bg-muted rounded animate-pulse" /><div className="h-6 w-8 bg-muted rounded animate-pulse" /></div><div className="h-8 w-8 bg-muted rounded animate-pulse" /></div></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-4"><div className="flex flex-col lg:flex-row gap-4"><div className="flex-1 h-10 bg-muted rounded animate-pulse" /><div className="h-10 w-[180px] bg-muted rounded animate-pulse" /><div className="h-10 w-[150px] bg-muted rounded animate-pulse" /></div></CardContent></Card>
      <Card><CardHeader><div className="h-6 w-32 bg-muted rounded animate-pulse" /></CardHeader><CardContent><div className="space-y-2"><SkeletonLoader count={6} /></div></CardContent></Card>
    </div>;
  }

  return <div className="container mx-auto px-6 py-8 space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{t('dashboard.title')}</h1></div>
      <div className="flex gap-2"><GenerateReportDialog /></div>
    </div>

    {/* Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.totalDialogs')}</p>
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
              <p className="text-sm text-muted-foreground">{t('dashboard.completedDialogs')}</p>
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
              <p className="text-sm text-muted-foreground">{t('dashboard.failedDialogs')}</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.avgScore')}</p>
              <p className="text-2xl font-bold">{stats.avgScore ?? t('common.noData')}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('dashboard.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder={t('dashboard.filterByStatus')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dashboard.allStatus')}</SelectItem>
              <SelectItem value="pending">{t('dashboard.pending')}</SelectItem>
              <SelectItem value="processing">{t('dashboard.processing')}</SelectItem>
              <SelectItem value="completed">{t('dashboard.completed')}</SelectItem>
              <SelectItem value="failed">{t('dashboard.failed')}</SelectItem>
            </SelectContent>
          </Select>
          {uniqueAgents.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[180px]"><Users className="h-4 w-4 mr-2" /><SelectValue placeholder={t('dashboard.filterByAgent')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('dashboard.allAgents')}</SelectItem>
                {uniqueAgents.map(agent => <SelectItem key={agent} value={agent}>{agent}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={t('dashboard.sortBy')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('dashboard.newestFirst')}</SelectItem>
              <SelectItem value="oldest">{t('dashboard.oldestFirst')}</SelectItem>
              <SelectItem value="name">{t('dashboard.nameAZ')}</SelectItem>
              <SelectItem value="status">{t('dashboard.status')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>{t('dashboard.dialogRecords')} ({filteredAndSortedDialogs.length})</CardTitle></CardHeader>
      <CardContent>
        {filteredAndSortedDialogs.length === 0 ? <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('dashboard.noDialogsFound')}</p>
        </div> : <div className="space-y-2">
          {paginatedDialogs.map(dialog => <div key={dialog.id}>
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium truncate">{dialog.fileName}</h3>
                    <Badge className={getStatusColor(dialog.status)}>
                      {getStatusIcon(dialog.status)}
                      <span className="ml-1">{getStatusLabel(dialog.status)}</span>
                    </Badge>
                    <span className="text-sm text-muted-foreground">{new Date(dialog.uploadDate).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{t('dashboard.supervisor')}: {dialog.assignedSupervisor}</span>
                    {dialog.qualityScore && <><span className="hidden sm:inline">•</span><span>{dialog.qualityScore}/100</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {dialog.status === 'failed' && (
                  <Button variant="outline" size="sm" onClick={() => handleRetryDialog(dialog)} title={t('dashboard.retry')}>
                    <RotateCcw className="h-4 w-4 mr-1" />{t('dashboard.retry')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => navigate(`/dialog/${dialog.id}`)}>{t('dashboard.viewDetails')}</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('dashboard.deleteDialog')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('dashboard.deleteConfirm')} "{dialog.fileName}"? {t('dashboard.deleteWarning')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('dashboard.cancel')}</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteDialog(dialog.id)}>{t('dashboard.delete')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>)}
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                {t('dashboard.showing')} {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedDialogs.length)} {t('dashboard.of')} {filteredAndSortedDialogs.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" />{t('dashboard.previous')}
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-2 text-muted-foreground">...</span>}
                        <Button variant={currentPage === page ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(page)}>{page}</Button>
                      </React.Fragment>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  {t('dashboard.next')}<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>}
      </CardContent>
    </Card>

    <RetryTranscriptionDialog dialog={retryDialog} open={isRetryDialogOpen} onOpenChange={setIsRetryDialogOpen} onSuccess={handleRetrySuccess} />
  </div>;
};

export default UnifiedDashboard;
