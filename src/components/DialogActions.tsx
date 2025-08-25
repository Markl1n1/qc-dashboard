
import React from 'react';
import { Button } from './ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  MoreVertical, 
  StopCircle, 
  Trash2,
  Eye
} from 'lucide-react';
import { Dialog } from '../types';

interface DialogActionsProps {
  dialog: Dialog;
  onView: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onStopProcessing: (e: React.MouseEvent) => void;
}

const DialogActions: React.FC<DialogActionsProps> = ({ 
  dialog, 
  onView, 
  onDelete, 
  onStopProcessing 
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </DropdownMenuItem>
        
        {(dialog.status === 'processing' || dialog.status === 'pending') && (
          <DropdownMenuItem onClick={onStopProcessing}>
            <StopCircle className="h-4 w-4 mr-2" />
            Stop Processing
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem 
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Dialog
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DialogActions;
