import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load heavy analysis components for code splitting
const LazyEnhancedDialogDetail = lazy(() => import('./EnhancedDialogDetail'));
const LazyAnalysisSummaryCards = lazy(() => import('./AnalysisSummaryCards'));
const LazyDeepgramSpeakerDialog = lazy(() => import('./DeepgramSpeakerDialog'));

// Loading fallback component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin" />
    <span className="ml-2">Loading...</span>
  </div>
);

// Memoized wrapper components for better performance
export const OptimizedEnhancedDialogDetail = React.memo((props: any) => (
  <Suspense fallback={<ComponentLoader />}>
    <LazyEnhancedDialogDetail {...props} />
  </Suspense>
));

export const OptimizedAnalysisSummaryCards = React.memo((props: any) => (
  <Suspense fallback={<ComponentLoader />}>
    <LazyAnalysisSummaryCards {...props} />
  </Suspense>
));

export const OptimizedDeepgramSpeakerDialog = React.memo((props: any) => (
  <Suspense fallback={<ComponentLoader />}>
    <LazyDeepgramSpeakerDialog {...props} />
  </Suspense>
));

OptimizedEnhancedDialogDetail.displayName = 'OptimizedEnhancedDialogDetail';
OptimizedAnalysisSummaryCards.displayName = 'OptimizedAnalysisSummaryCards';
OptimizedDeepgramSpeakerDialog.displayName = 'OptimizedDeepgramSpeakerDialog';