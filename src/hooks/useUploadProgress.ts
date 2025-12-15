import { useState, useCallback, useRef } from 'react';

interface UploadProgressState {
  isUploading: boolean;
  progress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

interface UseUploadProgressReturn {
  uploadState: UploadProgressState;
  uploadWithProgress: (
    url: string,
    data: FormData | Blob | string,
    options?: {
      headers?: Record<string, string>;
      method?: string;
    }
  ) => Promise<Response>;
  resetProgress: () => void;
  cancelUpload: () => void;
}

const initialState: UploadProgressState = {
  isUploading: false,
  progress: 0,
  uploadedBytes: 0,
  totalBytes: 0,
  speed: 0,
  estimatedTimeRemaining: 0,
};

export const useUploadProgress = (): UseUploadProgressReturn => {
  const [uploadState, setUploadState] = useState<UploadProgressState>(initialState);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const resetProgress = useCallback(() => {
    setUploadState(initialState);
    xhrRef.current = null;
  }, []);

  const cancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    resetProgress();
  }, [resetProgress]);

  const uploadWithProgress = useCallback(
    (
      url: string,
      data: FormData | Blob | string,
      options?: {
        headers?: Record<string, string>;
        method?: string;
      }
    ): Promise<Response> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        startTimeRef.current = Date.now();
        lastLoadedRef.current = 0;
        lastTimeRef.current = Date.now();

        // Calculate total size
        let totalBytes = 0;
        if (data instanceof FormData) {
          // For FormData, we need to calculate size from entries
          for (const [, value] of data.entries()) {
            if (value instanceof Blob) {
              totalBytes += value.size;
            } else if (typeof value === 'string') {
              totalBytes += new Blob([value]).size;
            }
          }
        } else if (data instanceof Blob) {
          totalBytes = data.size;
        } else if (typeof data === 'string') {
          totalBytes = new Blob([data]).size;
        }

        setUploadState({
          isUploading: true,
          progress: 0,
          uploadedBytes: 0,
          totalBytes,
          speed: 0,
          estimatedTimeRemaining: 0,
        });

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const now = Date.now();
            const timeDiff = (now - lastTimeRef.current) / 1000; // seconds
            const loadedDiff = event.loaded - lastLoadedRef.current;
            
            // Calculate speed (bytes per second) with smoothing
            const instantSpeed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
            const elapsedTime = (now - startTimeRef.current) / 1000;
            const averageSpeed = elapsedTime > 0 ? event.loaded / elapsedTime : 0;
            
            // Use weighted average for smoother display
            const speed = averageSpeed * 0.7 + instantSpeed * 0.3;
            
            // Calculate estimated time remaining
            const remainingBytes = event.total - event.loaded;
            const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;

            const progress = (event.loaded / event.total) * 100;

            setUploadState({
              isUploading: true,
              progress,
              uploadedBytes: event.loaded,
              totalBytes: event.total,
              speed,
              estimatedTimeRemaining,
            });

            lastLoadedRef.current = event.loaded;
            lastTimeRef.current = now;

            console.log(`[Upload Progress] ${progress.toFixed(1)}% - ${(event.loaded / 1024 / 1024).toFixed(2)}MB / ${(event.total / 1024 / 1024).toFixed(2)}MB - Speed: ${(speed / 1024 / 1024).toFixed(2)}MB/s`);
          }
        });

        xhr.addEventListener('load', () => {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            progress: 100,
          }));

          // Create a Response-like object from XMLHttpRequest
          const response = new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers(
              xhr.getAllResponseHeaders()
                .split('\r\n')
                .filter(Boolean)
                .reduce((acc, header) => {
                  const [key, value] = header.split(': ');
                  if (key && value) acc[key] = value;
                  return acc;
                }, {} as Record<string, string>)
            ),
          });

          resolve(response);
        });

        xhr.addEventListener('error', () => {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
          }));
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
          }));
          reject(new Error('Upload cancelled'));
        });

        xhr.open(options?.method || 'POST', url);

        // Set headers
        if (options?.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        xhr.send(data);
      });
    },
    []
  );

  return {
    uploadState,
    uploadWithProgress,
    resetProgress,
    cancelUpload,
  };
};

// Helper function to format bytes
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper function to format time
export const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};
