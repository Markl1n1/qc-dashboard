import { useState, useCallback } from 'react';
import { DialogData } from '../types/unified';
import { generateDialogPDF } from '../utils/pdfGenerator';
import { useLanguageStore } from '../store/languageStore';
import { toast } from 'sonner';

export const useDialogExport = () => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const { commentLanguage } = useLanguageStore();

  const exportToPDF = useCallback(async (dialog: DialogData) => {
    if (!dialog) return;
    
    setIsExportingPDF(true);
    try {
      generateDialogPDF(dialog, commentLanguage);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  }, [commentLanguage]);

  return {
    isExportingPDF,
    exportToPDF
  };
};