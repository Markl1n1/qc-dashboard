
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form"
import { Separator } from './ui/separator';
import { Switch } from "./ui/switch"
import { Slider } from "./ui/slider"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, Edit, Copy, Trash2, Settings } from 'lucide-react';
import { EvaluationConfiguration, EvaluationRule, EvaluationCategory, BannedWord } from '../types/lemurEvaluation';
import { evaluationRulesService } from '../services/evaluationRulesService';
import { evaluationCategoriesService } from '../services/evaluationCategoriesService';
import { bannedWordsService } from '../services/bannedWordsService';
import { arrayMove } from '@dnd-kit/sortable';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableItem } from './SortableItem';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ui/use-toast';
import { PromptContextManager } from './PromptContextManager';
import { promptContextService, PromptContext } from '../services/promptContextService';

interface LeMURConfigurationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigurationChange: (configuration: EvaluationConfiguration) => void;
}

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Configuration Name must be at least 2 characters.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }),
  scoringMethod: z.enum(["weighted", "penalty", "hybrid"]),
  minorMistakeWeight: z.number().min(1).max(10),
  majorMistakeWeight: z.number().min(1).max(10),
  criticalMistakeWeight:  z.number().min(1).max(10),
})

export const LeMURConfigurationManager: React.FC<LeMURConfigurationManagerProps> = ({
  isOpen,
  onClose,
  onConfigurationChange
}) => {
  const { toast } = useToast();
  const [configurations, setConfigurations] = useState<EvaluationConfiguration[]>([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState<EvaluationConfiguration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [rules, setRules] = useState<EvaluationRule[]>([]);
  const [categories, setCategories] = useState<EvaluationCategory[]>([]);
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);
  const [selectedPromptContext, setSelectedPromptContext] = useState<PromptContext | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      scoringMethod: "weighted",
      minorMistakeWeight: 1,
      majorMistakeWeight: 3,
      criticalMistakeWeight: 10
    },
  })

  useEffect(() => {
    loadConfigurations();
    loadRules();
    loadCategories();
    loadBannedWords();
  }, []);

  useEffect(() => {
    // Load selected configuration
    const stored = localStorage.getItem('lemur_configurations');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        if (configs.length > 0) {
          setConfigurations(configs);
          setSelectedConfiguration(configs[0]);
        }
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedConfiguration) {
      form.setValue("name", selectedConfiguration.name);
      form.setValue("description", selectedConfiguration.description);
      form.setValue("scoringMethod", selectedConfiguration.scoringMethod);
      form.setValue("minorMistakeWeight", selectedConfiguration.mistakeWeights.minor);
      form.setValue("majorMistakeWeight", selectedConfiguration.mistakeWeights.major);
      form.setValue("criticalMistakeWeight", selectedConfiguration.mistakeWeights.critical);
    }
  }, [selectedConfiguration, form.setValue]);

  useEffect(() => {
    // Load selected prompt context
    if (selectedConfiguration?.promptContextId) {
      const context = promptContextService.getContextById(selectedConfiguration.promptContextId);
      setSelectedPromptContext(context);
    } else {
      setSelectedPromptContext(promptContextService.getDefaultContext());
    }
  }, [selectedConfiguration]);

  const loadConfigurations = () => {
    const stored = localStorage.getItem('lemur_configurations');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        setConfigurations(configs);
      } catch (error) {
        console.error('Failed to load configurations:', error);
      }
    }
  };

  const loadRules = () => {
    setRules(evaluationRulesService.getRules());
  };

  const loadCategories = () => {
    setCategories(evaluationCategoriesService.getCategories());
  };

  const loadBannedWords = () => {
    setBannedWords(bannedWordsService.getBannedWords());
  };

  const handleConfigurationSelect = (config: EvaluationConfiguration) => {
    setSelectedConfiguration(config);
    setIsEditing(false);
  };

  const handleConfigurationUpdate = (config: EvaluationConfiguration) => {
    const updatedConfigurations = configurations.map(c => c.id === config.id ? config : c);
    setConfigurations(updatedConfigurations);
    localStorage.setItem('lemur_configurations', JSON.stringify(updatedConfigurations));
    setSelectedConfiguration(config);
    onConfigurationChange(config);
    toast({
      title: "Configuration Updated",
      description: `${config.name} has been updated`
    });
  };

  const createConfiguration = () => {
    const newConfig: EvaluationConfiguration = {
      id: uuidv4(),
      name: 'New Configuration',
      description: 'Custom evaluation configuration',
      rules: [],
      bannedWords: [],
      categories: [],
      enabledLanguages: ['en'],
      mistakeWeights: {
        minor: 1,
        major: 3,
        critical: 10
      },
      scoringMethod: 'weighted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setConfigurations([...configurations, newConfig]);
    setSelectedConfiguration(newConfig);
    setIsEditing(true);
  };

  const duplicateConfiguration = (config: EvaluationConfiguration) => {
    const duplicatedConfig: EvaluationConfiguration = {
      ...config,
      id: uuidv4(),
      name: `${config.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setConfigurations([...configurations, duplicatedConfig]);
    localStorage.setItem('lemur_configurations', JSON.stringify([...configurations, duplicatedConfig]));
    setSelectedConfiguration(duplicatedConfig);
    toast({
      title: "Configuration Duplicated",
      description: `${duplicatedConfig.name} has been duplicated`
    });
  };

  const deleteConfiguration = (config: EvaluationConfiguration) => {
    const updatedConfigurations = configurations.filter(c => c.id !== config.id);
    setConfigurations(updatedConfigurations);
    localStorage.setItem('lemur_configurations', JSON.stringify(updatedConfigurations));
    setSelectedConfiguration(updatedConfigurations.length > 0 ? updatedConfigurations[0] : null);
    onConfigurationChange(null as any);
    toast({
      title: "Configuration Deleted",
      description: `${config.name} has been deleted`
    });
  };

  const updateConfiguration = (config: EvaluationConfiguration) => {
    handleConfigurationUpdate(config);
    onConfigurationChange(config);
  };

  const handleRuleToggle = (ruleId: string) => {
    if (!selectedConfiguration) return;

    const isRuleSelected = selectedConfiguration.rules.some(rule => rule.id === ruleId);
    let updatedRules = [...selectedConfiguration.rules];

    if (isRuleSelected) {
      updatedRules = updatedRules.filter(rule => rule.id !== ruleId);
    } else {
      const ruleToAdd = rules.find(rule => rule.id === ruleId);
      if (ruleToAdd) {
        updatedRules.push(ruleToAdd);
      }
    }

    const updatedConfig: EvaluationConfiguration = {
      ...selectedConfiguration,
      rules: updatedRules,
      updatedAt: new Date().toISOString()
    };
    handleConfigurationUpdate(updatedConfig);
  };

  const isRuleSelected = (ruleId: string) => {
    if (!selectedConfiguration) return false;
    return selectedConfiguration.rules.some(rule => rule.id === ruleId);
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (!selectedConfiguration) return;

    const isCategoryEnabled = selectedConfiguration.categories.some(category => category.id === categoryId);
    let updatedCategories = selectedConfiguration.categories.map(category =>
      category.id === categoryId ? { ...category, enabled: !isCategoryEnabled } : category
    );

    const updatedConfig: EvaluationConfiguration = {
      ...selectedConfiguration,
      categories: updatedCategories,
      updatedAt: new Date().toISOString()
    };
    handleConfigurationUpdate(updatedConfig);
  };

  const isCategoryEnabled = (categoryId: string) => {
    if (!selectedConfiguration) return false;
    return selectedConfiguration.categories.some(category => category.id === categoryId && category.enabled);
  };

  const handleBannedWordToggle = (wordId: string) => {
    if (!selectedConfiguration) return;

    const isWordSelected = selectedConfiguration.bannedWords.some(word => word.id === wordId);
    let updatedWords = [...selectedConfiguration.bannedWords];

    if (isWordSelected) {
      updatedWords = updatedWords.filter(word => word.id !== wordId);
    } else {
      const wordToAdd = bannedWords.find(word => word.id === wordId);
      if (wordToAdd) {
        updatedWords.push(wordToAdd);
      }
    }

    const updatedConfig: EvaluationConfiguration = {
      ...selectedConfiguration,
      bannedWords: updatedWords,
      updatedAt: new Date().toISOString()
    };
    handleConfigurationUpdate(updatedConfig);
  };

  const isBannedWordSelected = (wordId: string) => {
    if (!selectedConfiguration) return false;
    return selectedConfiguration.bannedWords.some(word => word.id === wordId);
  };

  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const handleOnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && selectedConfiguration) {
      const oldIndex = selectedConfiguration.categories.findIndex(c => c.id === active.id);
      const newIndex = selectedConfiguration.categories.findIndex(c => c.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const updatedCategories = arrayMove(selectedConfiguration.categories, oldIndex, newIndex);
        const updatedConfig: EvaluationConfiguration = {
          ...selectedConfiguration,
          categories: updatedCategories,
          updatedAt: new Date().toISOString()
        };
        handleConfigurationUpdate(updatedConfig);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Evaluation Configurations
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage and customize your LeMUR evaluation configurations
          </p>
        </div>
        <Button onClick={createConfiguration}>
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      {/* Configuration Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {configurations.map(config => (
          <Card
            key={config.id}
            className={`cursor-pointer transition-all ${selectedConfiguration?.id === config.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => handleConfigurationSelect(config)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-base">{config.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {config.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(config.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateConfiguration(config);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConfiguration(config);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedConfiguration && (
        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="banned-words">Banned Words</TabsTrigger>
            <TabsTrigger value="prompt-context">Prompt Context</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Rules Tab */}
          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Rules</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enable or disable rules for this configuration
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.id} className="flex justify-between items-center">
                    <span>{rule.name}</span>
                    <Switch
                      checked={isRuleSelected(rule.id)}
                      onCheckedChange={() => handleRuleToggle(rule.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Evaluation Categories</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enable, disable, and reorder categories for this configuration
                </p>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  onDragEnd={handleOnDragEnd}
                >
                  <SortableContext
                    items={selectedConfiguration.categories.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {selectedConfiguration.categories.map(category => (
                        <SortableItem key={category.id} id={category.id}>
                          <div className="flex justify-between items-center">
                            <span>{category.name}</span>
                            <Switch
                              checked={isCategoryEnabled(category.id)}
                              onCheckedChange={() => handleCategoryToggle(category.id)}
                            />
                          </div>
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banned Words Tab */}
          <TabsContent value="banned-words">
            <Card>
              <CardHeader>
                <CardTitle>Banned Words</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enable or disable banned words for this configuration
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {bannedWords.map(word => (
                  <div key={word.id} className="flex justify-between items-center">
                    <span>{word.word}</span>
                    <Switch
                      checked={isBannedWordSelected(word.id)}
                      onCheckedChange={() => handleBannedWordToggle(word.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* New Prompt Context Tab */}
          <TabsContent value="prompt-context">
            <Card>
              <CardHeader>
                <CardTitle>Prompt Context Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Customize the AI evaluation prompts with your own context and instructions
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Context Display */}
                  {selectedPromptContext && (
                    <Alert>
                      <Settings className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex justify-between items-center">
                          <span>
                            Current Context: <strong>{selectedPromptContext.name}</strong>
                            {selectedPromptContext.isDefault && (
                              <Badge variant="outline" className="ml-2">Default</Badge>
                            )}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = {
                                ...selectedConfiguration,
                                promptContextId: undefined
                              };
                              updateConfiguration(updated);
                            }}
                          >
                            Reset to Default
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Prompt Context Manager */}
                  <PromptContextManager
                    selectedContextId={selectedConfiguration.promptContextId || 'default'}
                    onContextSelect={(context) => {
                      setSelectedPromptContext(context);
                      const updated = {
                        ...selectedConfiguration,
                        promptContextId: context.id === 'default' ? undefined : context.id
                      };
                      updateConfiguration(updated);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Configuration Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Customize the general settings for this configuration
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => {
                    const updatedConfig: EvaluationConfiguration = {
                      ...selectedConfiguration,
                      name: values.name,
                      description: values.description,
                      scoringMethod: values.scoringMethod,
                      mistakeWeights: {
                        minor: values.minorMistakeWeight,
                        major: values.majorMistakeWeight,
                        critical: values.criticalMistakeWeight
                      },
                      updatedAt: new Date().toISOString()
                    };
                    handleConfigurationUpdate(updatedConfig);
                  })} className="space-y-8">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Configuration Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Configuration Name" {...field} />
                          </FormControl>
                          <FormDescription>
                            This is the name that will be displayed for this configuration.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Configuration description."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Write a detailed description for internal use.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scoringMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scoring Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a scoring method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="weighted">Weighted</SelectItem>
                              <SelectItem value="penalty">Penalty</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the scoring method to use for this configuration.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator/>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="minorMistakeWeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minor Mistake Weight</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value]}
                                max={10}
                                step={1}
                                onValueChange={(value) => field.onChange(value[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Set the weight for minor mistakes.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="majorMistakeWeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Major Mistake Weight</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value]}
                                max={10}
                                step={1}
                                onValueChange={(value) => field.onChange(value[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Set the weight for major mistakes.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="criticalMistakeWeight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Critical Mistake Weight</FormLabel>
                            <FormControl>
                              <Slider
                                defaultValue={[field.value]}
                                max={10}
                                step={1}
                                onValueChange={(value) => field.onChange(value[0])}
                              />
                            </FormControl>
                            <FormDescription>
                              Set the weight for critical mistakes.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit">Update configuration</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!selectedConfiguration && (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            No configuration selected. Please create or select a configuration to customize.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
