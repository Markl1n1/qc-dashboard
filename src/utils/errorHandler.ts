import { toast } from 'sonner';

// Centralized error handling system
export class ErrorHandler {
  private static instance: ErrorHandler;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handleError(error: unknown, context: string = 'Unknown'): void {
    console.error(`[${context}] Error:`, error);
    
    if (error instanceof Error) {
      toast.error(`${context}: ${error.message}`);
    } else {
      toast.error(`${context}: An unexpected error occurred`);
    }
  }

  handleAsyncError(promise: Promise<any>, context: string): Promise<any> {
    return promise.catch((error) => {
      this.handleError(error, context);
      throw error;
    });
  }
}

export const errorHandler = ErrorHandler.getInstance();