import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface DetectedIssue {
  rule_category?: string;
  category?: string;
  comment?: string;
  utterance?: string;
}

interface AnalysisSummaryCardsProps {
  mistakes: DetectedIssue[];
}

const AnalysisSummaryCards: React.FC<AnalysisSummaryCardsProps> = ({ mistakes }) => {
  // Count violations by category
  const categoryCounts = mistakes.reduce((acc, mistake) => {
    const category = mistake.rule_category || mistake.category || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'banned':
        return 'destructive';
      case 'mistake':
        return 'destructive';
      case 'not recommended':
        return 'secondary';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Object.entries(categoryCounts).map(([category, count]) => (
        <Card key={category}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {category.replace(/_/g, ' ')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{count}</div>
              <Badge variant={getCategoryColor(category) as any}>
                {count === 1 ? 'Issue' : 'Issues'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Total violations card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{mistakes.length}</div>
            <Badge variant="outline">Total</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisSummaryCards;