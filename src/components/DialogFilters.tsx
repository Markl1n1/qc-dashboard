import React from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search } from 'lucide-react';
import { useTranslation } from '../i18n';

interface DialogFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

const DialogFilters: React.FC<DialogFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input placeholder={t('dialogFilters.searchPlaceholder')} value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-10" />
      </div>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('dialogFilters.filterByStatus')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('dialogFilters.allStatuses')}</SelectItem>
          <SelectItem value="completed">{t('dialogFilters.completed')}</SelectItem>
          <SelectItem value="processing">{t('dialogFilters.processing')}</SelectItem>
          <SelectItem value="pending">{t('dialogFilters.pending')}</SelectItem>
          <SelectItem value="failed">{t('dialogFilters.failed')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('dialogFilters.sortBy')} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="date">{t('dialogFilters.uploadDate')}</SelectItem>
          <SelectItem value="name">{t('dialogFilters.fileName')}</SelectItem>
          <SelectItem value="agent">{t('dialogFilters.agent')}</SelectItem>
          <SelectItem value="status">{t('dialogFilters.status')}</SelectItem>
          <SelectItem value="score">{t('dialogFilters.score')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default DialogFilters;
