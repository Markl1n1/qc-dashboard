import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Loader2, BarChart3, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface BackgroundAnalysisIndicatorProps {
  dialogId: string;
  dialogName: string;
  onClose: () => void;
}

const BackgroundAnalysisIndicator: React.FC<BackgroundAnalysisIndicatorProps> = ({
  dialogId,
  dialogName,
  onClose
}) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress animation
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90; // Cap at 90% until actual completion
        return prev + Math.random() * 10;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleViewDialog = () => {
    navigate(`/dialog/${dialogId}?tab=analysis`);
    onClose();
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg z-50 bg-background border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-medium text-sm">AI Analysis Running</span>
            <Badge variant="secondary" className="text-xs">Background</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-destructive/10"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground truncate">
              {dialogName}
            </p>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Analysis in progress... {Math.round(progress)}%
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDialog}
              className="flex-1"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              View Dialog
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BackgroundAnalysisIndicator;