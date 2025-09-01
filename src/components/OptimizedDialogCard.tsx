import React, { memo } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Eye, Trash2, Clock, User, Award } from 'lucide-react';
import { Dialog } from '../types';
import { format } from 'date-fns';

interface OptimizedDialogCardProps {
  dialog: Dialog;
  onViewDetails: (id: string) => void;
  onDelete: (id: string) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
}

const OptimizedDialogCard = memo<OptimizedDialogCardProps>(({
  dialog,
  onViewDetails,
  onDelete,
  getStatusColor,
  getStatusIcon
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-sm truncate" title={dialog.fileName}>
                {dialog.fileName}
              </h3>
              <Badge variant="outline" className={getStatusColor(dialog.status)}>
                <span className="flex items-center gap-1">
                  {getStatusIcon(dialog.status)}
                  <span className="capitalize">{dialog.status}</span>
                </span>
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(dialog.uploadDate), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate" title={dialog.assignedSupervisor}>
                  {dialog.assignedSupervisor}
                </span>
              </div>
              {dialog.qualityScore && (
                <div className="flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  <span>{dialog.qualityScore}/100</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(dialog.id)}
              className="h-8 px-2"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(dialog.id)}
              className="h-8 px-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

OptimizedDialogCard.displayName = 'OptimizedDialogCard';

export default OptimizedDialogCard;