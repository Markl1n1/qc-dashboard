import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useDialogStore } from '../store/dialogStore';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { FileAudio, Plus, Star, User, Copy, Check } from 'lucide-react';
import DialogActions from '../components/DialogActions';
import { Dialog } from '../types';

interface DialogFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const DialogFilters: React.FC<DialogFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange
}) => {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Search Input */}
      <div>
        <Label htmlFor="search">Search Dialogs</Label>
        <Input type="search" id="search" placeholder="Search by filename..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} />
      </div>

      {/* Status Filter */}
      <div>
        <Label htmlFor="status">Filter by Status</Label>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort By */}
      <div>
        <Label htmlFor="sort">Sort By</Label>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Upload Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uploadDate">Upload Date</SelectItem>
            <SelectItem value="fileName">File Name</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            {/* Add more sorting options as needed */}
          </SelectContent>
        </Select>
      </div>
    </div>;
};

interface DialogCopyIdProps {
  dialogId: string;
}

const DialogCopyId: React.FC<DialogCopyIdProps> = ({ dialogId }) => {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(dialogId);
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Dialog ID copied to clipboard",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy dialog ID to clipboard",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-mono text-muted-foreground">
        {dialogId}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0"
      >
        {isCopied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuthStore();
  const { dialogs, deleteDialog, stopProcessing } = useDialogStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('uploadDate');
  const [filteredDialogs, setFilteredDialogs] = useState<Dialog[]>([]);

  // Consolidate multi-segment dialogs into single entries
  const consolidateDialogs = useCallback((dialogList: Dialog[]): Dialog[] => {
    const consolidatedMap = new Map<string, Dialog>();
    
    dialogList.forEach(dialog => {
      if (dialog.isSegmented && dialog.parentDialogId) {
        // This is a segment - add it to the parent
        const parentId = dialog.parentDialogId;
        if (consolidatedMap.has(parentId)) {
          const parent = consolidatedMap.get(parentId)!;
          // Merge segment data into parent
          if (dialog.transcription) {
            parent.transcription = (parent.transcription || '') + '\n\n' + dialog.transcription;
          }
          if (dialog.speakerTranscription) {
            parent.speakerTranscription = [...(parent.speakerTranscription || []), ...dialog.speakerTranscription];
          }
          // Update segment count
          parent.segmentCount = Math.max(parent.segmentCount || 1, (dialog.segmentIndex || 0) + 1);
        } else {
          // Parent not found, treat this segment as standalone but mark it properly
          consolidatedMap.set(dialog.id, {
            ...dialog,
            fileName: dialog.fileName.replace(/\(Segment \d+\/\d+\)/, `(${dialog.segmentCount || 1} segments)`),
          });
        }
      } else if (dialog.isSegmented && dialog.childDialogIds?.length) {
        // This is a parent with segments
        const segmentCount = dialog.childDialogIds.length + 1; // +1 for the parent itself
        consolidatedMap.set(dialog.id, {
          ...dialog,
          fileName: dialog.fileName.replace(/\(Segment \d+\/\d+\)/, `(${segmentCount} segments)`),
          segmentCount,
        });
      } else {
        // Regular dialog or parent dialog
        consolidatedMap.set(dialog.id, dialog);
      }
    });

    return Array.from(consolidatedMap.values());
  }, []);

  const updateFilteredDialogs = useCallback(() => {
    let consolidated = consolidateDialogs(dialogs);

    // Apply search filter
    if (searchTerm) {
      consolidated = consolidated.filter(dialog => 
        dialog.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      consolidated = consolidated.filter(dialog => dialog.status === statusFilter);
    }

    // Apply sorting
    if (sortBy === 'uploadDate') {
      consolidated.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    } else if (sortBy === 'fileName') {
      consolidated.sort((a, b) => a.fileName.localeCompare(b.fileName));
    } else if (sortBy === 'agent') {
      consolidated.sort((a, b) => a.assignedAgent.localeCompare(b.assignedAgent));
    }
    
    setFilteredDialogs(consolidated);
  }, [dialogs, searchTerm, statusFilter, sortBy, consolidateDialogs]);

  useEffect(() => {
    updateFilteredDialogs();
  }, [dialogs, searchTerm, statusFilter, sortBy, updateFilteredDialogs]);

  const handleDeleteDialog = async (dialogId: string, fileName: string) => {
    try {
      await deleteDialog(dialogId);
      toast({
        title: "Dialog deleted",
        description: `${fileName} has been successfully deleted.`
      });
    } catch (error) {
      toast({
        title: "Failed to delete dialog",
        description: error instanceof Error ? error.message : "Failed to delete dialog",
        variant: "destructive"
      });
    }
  };

  const handleStopProcessing = async (dialogId: string, fileName: string) => {
    try {
      await stopProcessing(dialogId);
      toast({
        title: "Processing stopped",
        description: `Processing of ${fileName} has been stopped.`
      });
    } catch (error) {
      toast({
        title: "Failed to stop processing",
        description: error instanceof Error ? error.message : "Failed to stop processing",
        variant: "destructive"
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'processing':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'pending':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dialog History</h1>
        </div>
        <Button onClick={() => navigate('/upload')}>
          <Plus className="h-4 w-4 mr-2" />
          Upload New Dialog
        </Button>
      </div>

      <DialogFilters 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
        statusFilter={statusFilter} 
        onStatusChange={setStatusFilter} 
        sortBy={sortBy} 
        onSortChange={setSortBy} 
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Dialog</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDialogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' ? 'No dialogs match your filters' : 'No dialogs uploaded yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDialogs.map(dialog => (
                    <TableRow 
                      key={dialog.id} 
                      className="cursor-pointer hover:bg-muted/50" 
                      onClick={() => navigate(`/dialog/${dialog.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileAudio className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{dialog.fileName}</p>
                            <DialogCopyId dialogId={dialog.id} />
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm">{dialog.assignedAgent}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {new Date(dialog.uploadDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(dialog.uploadDate).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant={getStatusVariant(dialog.status)} className={`
                            ${dialog.status === 'processing' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                            ${dialog.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                            ${dialog.status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''}
                            ${dialog.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' : ''}
                          `}>
                          {dialog.status.charAt(0).toUpperCase() + dialog.status.slice(1)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        {dialog.lemurEvaluation ? (
                          <div className="flex items-center space-x-1">
                            <Star className={`h-4 w-4 ${
                              dialog.lemurEvaluation.overallScore >= 80 ? 'text-green-500' :
                              dialog.lemurEvaluation.overallScore >= 60 ? 'text-yellow-500' :
                              dialog.lemurEvaluation.overallScore >= 40 ? 'text-orange-500' :
                              'text-red-500'
                            }`} />
                            <span className={`text-sm font-medium ${
                              dialog.lemurEvaluation.overallScore >= 80 ? 'text-green-600' :
                              dialog.lemurEvaluation.overallScore >= 60 ? 'text-yellow-600' :
                              dialog.lemurEvaluation.overallScore >= 40 ? 'text-orange-600' :
                              'text-red-600'
                            }`}>
                              {dialog.lemurEvaluation.overallScore}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {dialog.status === 'processing' ? 'Processing...' : 'Not analyzed'}
                          </span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <DialogActions 
                          dialog={dialog} 
                          onView={(e) => {
                            e.stopPropagation();
                            navigate(`/dialog/${dialog.id}`);
                          }} 
                          onDelete={(e) => {
                            e.stopPropagation();
                            handleDeleteDialog(dialog.id, dialog.fileName);
                          }} 
                          onStopProcessing={(e) => {
                            e.stopPropagation();
                            handleStopProcessing(dialog.id, dialog.fileName);
                          }} 
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
