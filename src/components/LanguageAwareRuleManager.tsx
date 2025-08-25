import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Globe, 
  Languages, 
  AlertTriangle,
  CheckCircle,
  Filter,
  BarChart3
} from 'lucide-react';
import { EvaluationRule, SupportedLanguage, SUPPORTED_LANGUAGES } from '../types/lemurEvaluation';
import { evaluationRulesService } from '../services/evaluationRulesService';
import { evaluationCategoriesService } from '../services/evaluationCategoriesService';
import { languageDetectionService } from '../services/languageDetectionService';
import { useToast } from './ui/use-toast';

interface LanguageAwareRuleManagerProps {
  onRulesChange?: (rules: EvaluationRule[]) => void;
}

export const LanguageAwareRuleManager: React.FC<LanguageAwareRuleManagerProps> = ({
  onRulesChange
}) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<EvaluationRule[]>([]);
  const [categories, setCategories] = useState(evaluationCategoriesService.getCategories());
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | 'all'>('all');
  const [selectedRuleType, setSelectedRuleType] = useState<'all' | 'global' | 'language-specific'>('all');
  const [editingRule, setEditingRule] = useState<Partial<EvaluationRule> | null>(null);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [statistics, setStatistics] = useState(evaluationRulesService.getStatistics());

  useEffect(() => {
    loadRules();
  }, [selectedLanguage, selectedRuleType]);

  const loadRules = () => {
    let filteredRules = evaluationRulesService.getRules();
    
    if (selectedLanguage !== 'all') {
      filteredRules = evaluationRulesService.getCombinedRulesForLanguage(selectedLanguage as SupportedLanguage);
    }
    
    if (selectedRuleType !== 'all') {
      filteredRules = filteredRules.filter(rule => rule.ruleType === selectedRuleType);
    }
    
    setRules(filteredRules);
    setStatistics(evaluationRulesService.getStatistics());
    onRulesChange?.(filteredRules);
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    const errors = evaluationRulesService.validateRule(editingRule);
    if (errors.length > 0) {
      toast({
        title: "Validation Failed",
        description: errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingRule.id) {
        evaluationRulesService.updateRule(editingRule.id, editingRule);
        toast({
          title: "Rule Updated",
          description: `"${editingRule.name}" has been updated successfully.`
        });
      } else {
        const newRule = {
          ...editingRule,
          id: `${editingRule.ruleType}_${editingRule.category}_${Date.now()}`
        } as EvaluationRule;
        evaluationRulesService.addRule(newRule);
        toast({
          title: "Rule Created",
          description: `"${editingRule.name}" has been created successfully.`
        });
      }
      
      setShowRuleEditor(false);
      setEditingRule(null);
      loadRules();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save rule',
        variant: "destructive"
      });
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    try {
      evaluationRulesService.removeRule(ruleId);
      toast({
        title: "Rule Deleted",
        description: "Rule has been deleted successfully."
      });
      loadRules();
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete rule",
        variant: "destructive"
      });
    }
  };

  const handleCreateRule = (ruleType: 'global' | 'language-specific') => {
    const template = evaluationRulesService.createRuleTemplate(
      'general', 
      ruleType, 
      ruleType === 'language-specific' ? 'en' : undefined
    );
    setEditingRule(template);
    setShowRuleEditor(true);
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value as SupportedLanguage | 'all');
  };

  const handleRuleTypeChange = (value: string) => {
    setSelectedRuleType(value as 'all' | 'global' | 'language-specific');
  };

  const getRuleTypeIcon = (ruleType: string) => {
    return ruleType === 'global' ? <Globe className="h-4 w-4" /> : <Languages className="h-4 w-4" />;
  };

  const getRuleTypeColor = (ruleType: string) => {
    return ruleType === 'global' ? 'default' : 'secondary';
  };

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-semibold">Language-Aware Rule Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage global and language-specific evaluation rules
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => handleCreateRule('global')} 
            variant="outline"
            size="sm"
          >
            <Globe className="h-4 w-4 mr-2" />
            Global Rule
          </Button>
          <Button 
            onClick={() => handleCreateRule('language-specific')} 
            size="sm"
          >
            <Languages className="h-4 w-4 mr-2" />
            Language Rule
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{statistics.total}</div>
            <div className="text-sm text-muted-foreground">Total Rules</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{statistics.byRuleType.global || 0}</div>
            <div className="text-sm text-muted-foreground">Global Rules</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-secondary">{statistics.byRuleType['language-specific'] || 0}</div>
            <div className="text-sm text-muted-foreground">Language Rules</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">{statistics.required}</div>
            <div className="text-sm text-muted-foreground">Required Rules</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Filter by Language</Label>
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <Label>Filter by Type</Label>
              <Select value={selectedRuleType} onValueChange={handleRuleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="global">Global Rules</SelectItem>
                  <SelectItem value="language-specific">Language-Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Rules Found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first evaluation rule to get started.
              </p>
              <Button onClick={() => handleCreateRule('global')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Global Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant={getRuleTypeColor(rule.ruleType)}>
                        {getRuleTypeIcon(rule.ruleType)}
                        <span className="ml-1">
                          {rule.ruleType === 'global' ? 'Global' : rule.language?.toUpperCase()}
                        </span>
                      </Badge>
                      {rule.required && (
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {rule.priority}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {rule.description}
                    </p>
                    
                    {rule.culturalContext && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Cultural Context:</strong> {rule.culturalContext}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Category: {rule.category}</span>
                      <span>Weight: {rule.weight}</span>
                      <span>Examples: {rule.examples.good.length} good, {rule.examples.bad.length} bad</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRule(rule);
                        setShowRuleEditor(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rule Editor Dialog */}
      <Dialog open={showRuleEditor} onOpenChange={setShowRuleEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
          </DialogHeader>
          
          {editingRule && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    value={editingRule.name || ''}
                    onChange={(e) => setEditingRule({...editingRule, name: e.target.value})}
                    placeholder="Enter rule name..."
                  />
                </div>
                
                <div>
                  <Label>Rule Type</Label>
                  <Select 
                    value={editingRule.ruleType} 
                    onValueChange={(value: string) => 
                      setEditingRule({...editingRule, ruleType: value as 'global' | 'language-specific', language: value === 'global' ? undefined : 'en'})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (All Languages)</SelectItem>
                      <SelectItem value="language-specific">Language-Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingRule.ruleType === 'language-specific' && (
                <div>
                  <Label>Target Language</Label>
                  <Select 
                    value={editingRule.language} 
                    onValueChange={(value: string) => 
                      setEditingRule({...editingRule, language: value as SupportedLanguage})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingRule.description || ''}
                  onChange={(e) => setEditingRule({...editingRule, description: e.target.value})}
                  placeholder="Describe what this rule evaluates..."
                  rows={3}
                />
              </div>

              {editingRule.ruleType === 'language-specific' && (
                <div>
                  <Label>Cultural Context</Label>
                  <Textarea
                    value={editingRule.culturalContext || ''}
                    onChange={(e) => setEditingRule({...editingRule, culturalContext: e.target.value})}
                    placeholder="Explain the cultural context for this rule..."
                    rows={2}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select 
                    value={editingRule.category} 
                    onValueChange={(value) => setEditingRule({...editingRule, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Weight (0-1)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editingRule.weight || 0.5}
                    onChange={(e) => setEditingRule({...editingRule, weight: parseFloat(e.target.value)})}
                  />
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select 
                    value={editingRule.priority} 
                    onValueChange={(value: string) => 
                      setEditingRule({...editingRule, priority: value as 'high' | 'medium' | 'low'})
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingRule.required || false}
                  onCheckedChange={(checked) => setEditingRule({...editingRule, required: checked})}
                />
                <Label>Required Rule</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Good Examples</Label>
                  <Textarea
                    value={editingRule.examples?.good?.join('\n') || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule, 
                      examples: {
                        ...editingRule.examples,
                        good: e.target.value.split('\n').filter(line => line.trim())
                      }
                    })}
                    placeholder="Enter good examples (one per line)..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Bad Examples</Label>
                  <Textarea
                    value={editingRule.examples?.bad?.join('\n') || ''}
                    onChange={(e) => setEditingRule({
                      ...editingRule, 
                      examples: {
                        ...editingRule.examples,
                        bad: e.target.value.split('\n').filter(line => line.trim())
                      }
                    })}
                    placeholder="Enter bad examples (one per line)..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRuleEditor(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRule}>
                  {editingRule.id ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
