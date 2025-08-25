
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, Edit, Trash2, Settings, Save } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { EvaluationConfiguration, EvaluationCategory, EvaluationRule, DEFAULT_RULE_CATEGORIES } from '../types/lemurEvaluation';

interface EvaluationConfigurationManagerProps {
  onConfigurationSave: (config: EvaluationConfiguration) => void;
  onClose?: () => void;
}

export const EvaluationConfigurationManager: React.FC<EvaluationConfigurationManagerProps> = ({
  onConfigurationSave,
  onClose
}) => {
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<EvaluationConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<EvaluationConfiguration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [configName, setConfigName] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [categories, setCategories] = useState<EvaluationCategory[]>([]);

  useEffect(() => {
    loadConfigurations();
    // Initialize with default categories if none exist
    if (categories.length === 0) {
      setCategories(DEFAULT_RULE_CATEGORIES);
    }
  }, []);

  useEffect(() => {
    if (categories.length === 0) {
      setCategories(DEFAULT_RULE_CATEGORIES);
    }
  }, [categories.length]);

  const loadConfigurations = () => {
    const stored = localStorage.getItem('evaluation_configurations');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        setConfigurations(configs);
      } catch (error) {
        console.error('Failed to load configurations:', error);
      }
    }
  };

  const saveConfiguration = () => {
    if (!configName.trim()) {
      toast({
        title: "Error",
        description: "Configuration name is required",
        variant: "destructive"
      });
      return;
    }

    const config: EvaluationConfiguration = {
      id: selectedConfig?.id || `config_${Date.now()}`,
      name: configName,
      description: configDescription,
      rules: [], // Initialize empty rules array
      bannedWords: [], // Initialize empty banned words array
      categories: categories,
      enabledLanguages: ['en'], // Default to English
      mistakeWeights: {
        minor: 1,
        major: 3,
        critical: 10
      },
      scoringMethod: 'weighted',
      createdAt: selectedConfig?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedConfigs = selectedConfig
      ? configurations.map(c => c.id === selectedConfig.id ? config : c)
      : [...configurations, config];

    setConfigurations(updatedConfigs);
    localStorage.setItem('evaluation_configurations', JSON.stringify(updatedConfigs));
    
    onConfigurationSave(config);
    setIsEditing(false);
    setSelectedConfig(config);

    toast({
      title: "Success",
      description: `Configuration "${config.name}" saved successfully`
    });
  };

  const createNewConfiguration = () => {
    setSelectedConfig(null);
    setConfigName('');
    setConfigDescription('');
    setCategories(DEFAULT_RULE_CATEGORIES);
    setIsEditing(true);
  };

  const editConfiguration = (config: EvaluationConfiguration) => {
    setSelectedConfig(config);
    setConfigName(config.name);
    setConfigDescription(config.description);
    setCategories(config.categories);
    setIsEditing(true);
  };

  const deleteConfiguration = (configId: string) => {
    const updatedConfigs = configurations.filter(c => c.id !== configId);
    setConfigurations(updatedConfigs);
    localStorage.setItem('evaluation_configurations', JSON.stringify(updatedConfigs));
    
    if (selectedConfig?.id === configId) {
      setSelectedConfig(null);
    }

    toast({
      title: "Success",
      description: "Configuration deleted successfully"
    });
  };

  const updateCategoryWeight = (categoryId: string, weight: number) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, weight } : cat
    ));
  };

  const toggleCategory = (categoryId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    ));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluation Configuration Manager</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Configuration List */}
          {!isEditing && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Saved Configurations</h3>
                <Button onClick={createNewConfiguration}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Configuration
                </Button>
              </div>
              
              <div className="grid gap-3">
                {configurations.map(config => (
                  <Card key={config.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{config.name}</h4>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                        <div className="flex gap-2 mt-2">
                          {config.categories.filter(c => c.enabled).map(cat => (
                            <Badge 
                              key={cat.id} 
                              variant={cat.id === 'critical' ? 'destructive' : 'default'}
                            >
                              {cat.name} (W:{cat.weight})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => editConfiguration(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteConfiguration(config.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Configuration Editor */}
          {isEditing && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  {selectedConfig ? 'Edit Configuration' : 'New Configuration'}
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveConfiguration}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="config-name">Configuration Name</Label>
                  <Input
                    id="config-name"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="e.g., Customer Service Standard"
                  />
                </div>
                <div>
                  <Label htmlFor="config-description">Description</Label>
                  <Textarea
                    id="config-description"
                    value={configDescription}
                    onChange={(e) => setConfigDescription(e.target.value)}
                    placeholder="Describe this evaluation configuration..."
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-4">
                <h4 className="font-medium">Categories</h4>
                
                {categories.map(category => (
                  <Card key={category.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={category.enabled}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Weight: {category.weight}</Label>
                        <Slider
                          value={[category.weight || 1]}
                          onValueChange={(value) => updateCategoryWeight(category.id, value[0])}
                          max={10}
                          min={1}
                          step={1}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
