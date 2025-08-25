
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Settings, Check } from 'lucide-react';
import { EvaluationConfiguration } from '../types/lemurEvaluation';

interface EvaluationConfigurationSelectorProps {
  selectedConfiguration: EvaluationConfiguration | null;
  onConfigurationSelect: (config: EvaluationConfiguration) => void;
  onOpenConfigManager: () => void;
}

export const EvaluationConfigurationSelector: React.FC<EvaluationConfigurationSelectorProps> = ({
  selectedConfiguration,
  onConfigurationSelect,
  onOpenConfigManager
}) => {
  const [configurations, setConfigurations] = useState<EvaluationConfiguration[]>([]);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = () => {
    const stored = localStorage.getItem('lemur_configurations');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        setConfigurations(configs);
        
        // If no configuration is selected and we have configurations, select the first one
        if (!selectedConfiguration && configs.length > 0) {
          onConfigurationSelect(configs[0]);
        }
      } catch (error) {
        console.error('Failed to load configurations:', error);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Evaluation Configuration</h3>
        <Button variant="outline" size="sm" onClick={onOpenConfigManager}>
          <Settings className="h-4 w-4 mr-2" />
          Manage
        </Button>
      </div>

      {configurations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configurations.map((config) => (
            <Card
              key={config.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedConfiguration?.id === config.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onConfigurationSelect(config)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium line-clamp-1">
                    {config.name}
                  </CardTitle>
                  {selectedConfiguration?.id === config.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {config.description}
                </p>
                
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {config.rules.filter(r => r.ruleType === 'global').length} global
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {config.rules.filter(r => r.ruleType === 'language-specific').length} language
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {config.categories.filter(c => c.enabled).length} categories
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  Method: {config.scoringMethod}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No evaluation configurations found
          </p>
          <Button variant="outline" onClick={onOpenConfigManager}>
            <Settings className="h-4 w-4 mr-2" />
            Create Configuration
          </Button>
        </Card>
      )}
    </div>
  );
};
