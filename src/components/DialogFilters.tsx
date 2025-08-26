
import React from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface DialogFiltersProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
}

const DialogFilters: React.FC<DialogFiltersProps> = ({
  statusFilter,
  onStatusChange
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Label htmlFor="status-filter">Filter by Status</Label>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default DialogFilters;
