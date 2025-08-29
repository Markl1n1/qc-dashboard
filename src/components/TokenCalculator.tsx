
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calculator, DollarSign, Hash, FileText } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { 
  tokenCalculatorService, 
  OpenAITokenCalculation
} from '../utils/tokenCalculator';

interface TokenCalculatorProps {
  utterances: SpeakerUtterance[];
  evaluationType: 'openai';
  selectedModel?: string;
}

const TokenCalculator: React.FC<TokenCalculatorProps> = ({ 
  utterances, 
  evaluationType, 
  selectedModel = 'gpt-5-mini-2025-08-07' 
}) => {
const calculation = tokenCalculatorService.calculateOpenAITokens(
  utterances,
  selectedModel
);


  const formatCost = (cost: number) => {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(3)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calculator className="h-4 w-4" />
          Token Calculator
        </CardTitle>
        <CardDescription className="text-xs">
          Estimated usage for OpenAI evaluation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Text Length</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {calculation.textLength.toLocaleString()} chars
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">Input</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {formatTokens(calculation.inputTokens)} tokens
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Output</span>
            </div>
            <Badge variant="outline" className="text-xs">
              ~{formatTokens(calculation.estimatedOutputTokens)} tokens
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3 text-purple-500" />
              <span className="text-muted-foreground">Total</span>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {formatTokens(calculation.totalTokens)} tokens
            </Badge>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-medium">Estimated Cost</span>
            </div>
            <Badge variant="secondary" className="text-sm font-semibold">
              {formatCost(calculation.estimatedCost)}
            </Badge>
          </div>
        </div>

        {evaluationType === 'openai' && 'model' in calculation && (
          <div className="text-xs text-muted-foreground pt-1">
            Using {calculation.model} (${calculation.costPer1kTokens}/1k tokens)
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenCalculator;
