import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { EvaluationMistake, MISTAKE_LEVELS } from '../types/lemurEvaluation';

interface LeMURMistakeHighlightProps {
  mistakes: EvaluationMistake[];
  onMistakeClick?: (mistake: EvaluationMistake) => void;
  showDetails?: boolean;
}

export const LeMURMistakeHighlight: React.FC<LeMURMistakeHighlightProps> = ({
  mistakes,
  onMistakeClick,
  showDetails = false
}) => {
  const getMistakeIcon = (level: EvaluationMistake['level']) => {
    switch (level) {
      case 'minor':
        return <Info className="h-4 w-4" />;
      case 'major':
        return <AlertTriangle className="h-4 w-4" />;
      case 'critical':
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getMistakeClass = (level: EvaluationMistake['level']) => {
    switch (level) {
      case 'minor':
        return 'quality-level-1';
      case 'major':
        return 'quality-level-2';
      case 'critical':
        return 'quality-level-3';
    }
  };

  const groupedMistakes = mistakes.reduce((acc, mistake) => {
    if (!acc[mistake.level]) {
      acc[mistake.level] = [];
    }
    acc[mistake.level].push(mistake);
    return acc;
  }, {} as Record<EvaluationMistake['level'], EvaluationMistake[]>);

  if (mistakes.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-success">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">No issues detected</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            This conversation meets all evaluation criteria
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(groupedMistakes).map(([level, levelMistakes]) => {
          const mistakeLevel = MISTAKE_LEVELS[level as keyof typeof MISTAKE_LEVELS];
          return (
            <Badge 
              key={level} 
              variant="outline" 
              className={getMistakeClass(level as EvaluationMistake['level'])}
            >
              {getMistakeIcon(level as EvaluationMistake['level'])}
              <span className="ml-1">
                {levelMistakes.length} {mistakeLevel.name}
              </span>
            </Badge>
          );
        })}
      </div>

      {/* Detailed Mistakes */}
      {showDetails && (
        <div className="space-y-3">
          {Object.entries(groupedMistakes).map(([level, levelMistakes]) => {
            const mistakeLevel = MISTAKE_LEVELS[level as keyof typeof MISTAKE_LEVELS];
            
            return (
              <div key={level} className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  {getMistakeIcon(level as EvaluationMistake['level'])}
                  {mistakeLevel.name} Issues ({levelMistakes.length})
                </h4>
                
                <div className="space-y-2">
                  {levelMistakes.map((mistake) => (
                    <TooltipProvider key={mistake.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Card 
                            className={`cursor-pointer transition-colors hover:bg-muted/50 ${getMistakeClass(mistake.level)}`}
                            onClick={() => onMistakeClick?.(mistake)}
                          >
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {mistake.category}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {mistake.speaker}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {mistake.confidence}% confidence
                                    </span>
                                  </div>
                                  
                                  <p className="text-sm font-medium mb-1">
                                    {mistake.description}
                                  </p>
                                  
                                  {mistake.text && (
                                    <p className="text-xs text-muted-foreground mb-2 italic">
                                      "{mistake.text}"
                                    </p>
                                  )}
                                  
                                  <p className="text-xs text-muted-foreground">
                                    💡 {mistake.suggestion}
                                  </p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${getMistakeClass(mistake.level)}`}
                                  >
                                    {mistakeLevel.name}
                                  </Badge>
                                  
                                  <Badge variant="outline" className="text-xs">
                                    {mistake.impact} impact
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </TooltipTrigger>
                        
                        <TooltipContent side="bottom" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">{mistake.description}</p>
                            {mistake.ruleId && (
                              <p className="text-xs text-muted-foreground">
                                Rule: {mistake.ruleId}
                              </p>
                            )}
                            <p className="text-xs">
                              <strong>Suggestion:</strong> {mistake.suggestion}
                            </p>
                            {mistake.timestamp && (
                              <p className="text-xs text-muted-foreground">
                                At: {Math.floor(mistake.timestamp / 1000)}s
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};