import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryAnalysisProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryAnalysisState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryAnalysis extends Component<ErrorBoundaryAnalysisProps, ErrorBoundaryAnalysisState> {
  constructor(props: ErrorBoundaryAnalysisProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryAnalysisState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Analysis Error Boundary caught an error:', error, errorInfo);
    
    // Log specific analysis-related errors
    if (error.message.includes('recommendations') || error.message.includes('openaiEvaluation')) {
      console.error('🔍 Analysis data structure error detected:', {
        error: error.message,
        stack: error.stack,
        component: errorInfo.componentStack
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Analysis Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>There was an error displaying the analysis results.</p>
              {this.state.error && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium">Technical Details</summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={this.handleRetry}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline" 
                size="sm"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryAnalysis;