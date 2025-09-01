import React from 'react';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

interface SkeletonLoaderProps {
  count?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 6 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};

export default SkeletonLoader;