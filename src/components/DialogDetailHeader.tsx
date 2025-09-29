import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { ArrowLeft, FileText, Loader2, AlertCircle } from 'lucide-react';
import { DialogData } from '../types/unified';
import { extractUsernameFromEmail, capitalizeStatus } from '../utils/userUtils';

interface DialogDetailHeaderProps {
  dialog: DialogData;
  isExportingPDF: boolean;
  onExportPDF: () => void;
}

const DialogDetailHeader: React.FC<DialogDetailHeaderProps> = ({
  dialog,
  isExportingPDF,
  onExportPDF
}) => {
  const getStatusColor = (status: DialogData['status']) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <Badge className={getStatusColor(dialog.status)}>
          {capitalizeStatus(dialog.status)}
        </Badge>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{dialog.fileName}</h1>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Supervisor: {extractUsernameFromEmail(dialog.assignedSupervisor)}</span>
            <span>•</span>
            <span>Uploaded: {new Date(dialog.uploadDate).toLocaleDateString()}</span>
            {dialog.qualityScore && (
              <>
                <span>•</span>
                <span>Quality Score: {dialog.qualityScore}%</span>
              </>
            )}
          </div>
        </div>
        
        <Button 
          onClick={onExportPDF} 
          disabled={isExportingPDF || !dialog.speakerTranscription} 
          variant="outline" 
          size="sm"
        >
          {isExportingPDF ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </>
          )}
        </Button>
      </div>
      
      {/* Error message for failed dialogs */}
      {dialog.status === 'failed' && dialog.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Transcription failed:</strong> {dialog.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default DialogDetailHeader;