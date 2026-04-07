import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CalendarIcon, BarChart3, Loader2 } from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { reportService } from '../services/reportService';
import { useTranslation } from '../i18n';

interface GenerateReportDialogProps {
  trigger?: React.ReactNode;
}

const GenerateReportDialog: React.FC<GenerateReportDialogProps> = ({ trigger }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [reportType, setReportType] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const reportTypes = [
    { value: 'average-quality-by-agent', label: t('report.avgQualityByAgent') },
    { value: 'type-b', label: t('report.typeBComing') },
    { value: 'type-c', label: t('report.typeCComing') }
  ];

  const datePresets = [
    { label: t('report.days7'), getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: t('report.days30'), getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: t('report.thisMonth'), getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  ];

  const applyPreset = (preset: typeof datePresets[0]) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
  };

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) { toast.error(t('report.selectBothDates')); return; }
    if (!reportType) { toast.error(t('report.selectType')); return; }
    if (dateFrom > dateTo) { toast.error(t('report.startBeforeEnd')); return; }

    setIsGenerating(true);
    try {
      let reportBlob: Blob;
      switch (reportType) {
        case 'average-quality-by-agent':
          reportBlob = await reportService.generateAverageQualityByAgentReport(dateFrom, dateTo);
          break;
        default:
          toast.error(t('report.notImplemented'));
          return;
      }
      const url = URL.createObjectURL(reportBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-${format(dateFrom, 'yyyy-MM-dd')}-to-${format(dateTo, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('report.success'));
      setIsOpen(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(t('report.failed'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('report.generateReport')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('report.generateReport')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('report.quickDateSelect')}</Label>
            <div className="flex gap-2">
              {datePresets.map((preset) => (
                <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)} className="flex-1">
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('report.dateFrom')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : t('report.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t('report.dateTo')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : t('report.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('report.reportType')}</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder={t('report.selectReportType')} />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} disabled={type.value !== 'average-quality-by-agent'}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isGenerating}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('report.generating')}</>
              ) : t('report.generateReport')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateReportDialog;
