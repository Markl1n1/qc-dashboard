import React from 'react';
import { useBackgroundAnalysis } from '../hooks/useBackgroundAnalysis';
import BackgroundAnalysisIndicator from './BackgroundAnalysisIndicator';

const BackgroundAnalysisManager = () => {
  const { runningAnalyses, removeAnalysis } = useBackgroundAnalysis();

  return (
    <>
      {runningAnalyses.map((analysis) => (
        <BackgroundAnalysisIndicator
          key={analysis.dialogId}
          dialogId={analysis.dialogId}
          dialogName={analysis.dialogName}
          onClose={() => removeAnalysis(analysis.dialogId)}
        />
      ))}
    </>
  );
};

export default BackgroundAnalysisManager;