
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../services/loggingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Enhanced error boundary with proper error reporting
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log the error properly instead of console.error
    logger.error('React Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="mt-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Something went wrong</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      An unexpected error occurred. Please try refreshing the page.
                    </p>
                  </div>
                   <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {this.state.error?.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={this.handleReset}
                      variant="outline"
                      size="sm"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={this.handleReload}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reload Page
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
