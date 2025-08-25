import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Target, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Star,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { SalesAnalysisResult } from '../types/salesAnalysis';

interface SalesAnalysisViewProps {
  analysis: SalesAnalysisResult;
}

const SalesAnalysisView: React.FC<SalesAnalysisViewProps> = ({ analysis }) => {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImportanceBadge = (importance: string) => {
    const variants: Record<string, string> = {
      'high': 'bg-red-100 text-red-700 border-red-200',
      'medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'low': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return variants[importance] || variants['medium'];
  };

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Sales Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold mb-2 ${getScoreColor(analysis.overallScore)}`}>
                {analysis.overallScore}/100
              </div>
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <Progress value={analysis.overallScore} className="mt-2" />
            </div>
            
            <div className="text-center">
              <Badge className={getSentimentColor(analysis.sentiment.overall)}>
                {analysis.sentiment.overall.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">Overall Sentiment</p>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {analysis.talkRatio.agent}% / {analysis.talkRatio.customer}%
              </div>
              <p className="text-sm text-muted-foreground">Agent / Customer Talk Ratio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Stages Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Sales Stages Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(analysis.salesStages).map(([stage, data]) => (
              <div key={stage} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold capitalize">
                    {stage.replace(/([A-Z])/g, ' $1').trim()}
                  </h4>
                  <div className={`font-bold ${getScoreColor(data.score)}`}>
                    {data.score}/100
                  </div>
                </div>
                <Progress value={data.score} className="mb-2" />
                <p className="text-sm text-muted-foreground mb-2">{data.feedback}</p>
                
                {data.keyPhases.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Key Phases:</p>
                    <div className="flex flex-wrap gap-1">
                      {data.keyPhases.map((phase, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {phase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {data.improvements.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Improvements:</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside">
                      {data.improvements.map((improvement, idx) => (
                        <li key={idx}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Moments */}
      {analysis.keyMoments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Key Moments ({analysis.keyMoments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.keyMoments.map((moment, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getImportanceBadge(moment.importance)}`}>
                    {moment.importance.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {moment.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {moment.speaker}
                      </span>
                    </div>
                    <p className="text-sm">{moment.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{moment.context}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buying Signals */}
      {analysis.buyingSignals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ThumbsUp className="h-5 w-5 mr-2 text-green-600" />
              Buying Signals ({analysis.buyingSignals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.buyingSignals.map((signal, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          signal.strength === 'strong' ? 'bg-green-100 text-green-700' :
                          signal.strength === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {signal.strength.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Confidence: {signal.confidence}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">{signal.signal}</p>
                    <p className="text-xs text-muted-foreground mt-1">{signal.context}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objections */}
      {analysis.objections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Objections & Handling ({analysis.objections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.objections.map((objection, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {objection.category.toUpperCase()}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      {objection.handled ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-xs font-medium ${getScoreColor(objection.effectiveness)}`}>
                        {objection.effectiveness}% effective
                      </span>
                    </div>
                  </div>
                  <p className="text-sm mb-2">
                    <strong>Objection:</strong> {objection.objection}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Response:</strong> {objection.agentResponse}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {analysis.actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.actionItems.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            Coaching Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <div className="h-2 w-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
          <Separator className="my-4" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Analysis Confidence: {analysis.confidence}%</span>
            <span>Processing Time: {analysis.processingTime}ms</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesAnalysisView;