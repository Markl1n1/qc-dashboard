
import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface AgentCsvImportProps {
  onImportComplete: () => void;
  onBulkCreate: (agentNames: string[]) => Promise<void>;
}

interface ImportResult {
  successful: string[];
  failed: Array<{ name: string; error: string }>;
}

const AgentCsvImport: React.FC<AgentCsvImportProps> = ({ 
  onImportComplete, 
  onBulkCreate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }

      // Validate file size (max 1MB to respect Edge Function limits)
      if (selectedFile.size > 1024 * 1024) {
        toast.error('File size must be less than 1MB');
        return;
      }

      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const parseCsvContent = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const agentNames: string[] = [];
            
            // Extract agent names from each row
            results.data.forEach((row: any) => {
              if (Array.isArray(row)) {
                // Take the first column as agent name
                const name = String(row[0] || '').trim();
                if (name && !agentNames.includes(name)) {
                  agentNames.push(name);
                }
              }
            });

            resolve(agentNames);
          } catch (error) {
            reject(new Error('Failed to parse CSV data'));
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImportResult(null);

    try {
      // Parse CSV file
      const agentNames = await parseCsvContent(file);

      if (agentNames.length === 0) {
        toast.error('No valid agent names found in the CSV file');
        setIsProcessing(false);
        return;
      }

      if (agentNames.length > 100) {
        toast.error('Maximum 100 agents can be imported at once');
        setIsProcessing(false);
        return;
      }

      setProgress(25);

      // Process agents in batches to respect Edge Function limits
      const batchSize = 10;
      const successful: string[] = [];
      const failed: Array<{ name: string; error: string }> = [];

      for (let i = 0; i < agentNames.length; i += batchSize) {
        const batch = agentNames.slice(i, i + batchSize);
        
        try {
          await onBulkCreate(batch);
          successful.push(...batch);
        } catch (error: any) {
          // If batch fails, try individual agents
          for (const name of batch) {
            try {
              await onBulkCreate([name]);
              successful.push(name);
            } catch (individualError: any) {
              failed.push({ 
                name, 
                error: individualError.message || 'Unknown error' 
              });
            }
          }
        }

        // Update progress
        const completedCount = Math.min(i + batchSize, agentNames.length);
        setProgress(25 + (completedCount / agentNames.length) * 70);
      }

      setProgress(100);
      setImportResult({ successful, failed });

      if (successful.length > 0) {
        toast.success(`Successfully imported ${successful.length} agents`);
        onImportComplete();
      }

      if (failed.length > 0) {
        toast.error(`Failed to import ${failed.length} agents`);
      }

    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setProgress(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Agents from CSV</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each line should contain one agent name. Max file size: 1MB, Max agents: 100
            </p>
          </div>

          {file && (
            <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
              <FileText className="h-4 w-4" />
              <span className="text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Processing... {progress.toFixed(0)}%
              </p>
            </div>
          )}

          {importResult && (
            <div className="space-y-3">
              {importResult.successful.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported {importResult.successful.length} agents:
                    <div className="mt-2 text-xs">
                      {importResult.successful.slice(0, 5).join(', ')}
                      {importResult.successful.length > 5 && ` and ${importResult.successful.length - 5} more...`}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {importResult.failed.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to import {importResult.failed.length} agents:
                    <div className="mt-2 text-xs">
                      {importResult.failed.slice(0, 3).map(item => (
                        <div key={item.name}>
                          {item.name}: {item.error}
                        </div>
                      ))}
                      {importResult.failed.length > 3 && <div>And {importResult.failed.length - 3} more...</div>}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || isProcessing}
            >
              {isProcessing ? 'Importing...' : 'Import Agents'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentCsvImport;