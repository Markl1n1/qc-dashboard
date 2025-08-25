
import { SupportedLanguage } from '../types/lemurEvaluation';

export interface PromptContext {
  id: string;
  name: string;
  description: string;
  systemPromptContext: string;
  evaluationContext: string;
  language?: SupportedLanguage; // Optional language-specific context
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptContextVariables {
  language: string;
  languageName: string;
  confidence: number;
  configurationName: string;
  globalRules: string;
  languageSpecificRules: string;
  conversation: string;
  culturalNotes: string;
  evaluationEmphasis: string;
}

class PromptContextService {
  private readonly STORAGE_KEY = 'lemur_prompt_contexts';

  getDefaultContext(): PromptContext {
    return {
      id: 'default',
      name: 'Default Customer Service Context',
      description: 'Standard customer service evaluation context',
      systemPromptContext: `You are an expert conversation analyst specializing in {{languageName}} customer service evaluation.

Your role is to:
- Analyze professional customer service interactions
- Evaluate communication quality and compliance
- Identify improvement opportunities
- Provide actionable coaching feedback

{{culturalNotes}}
{{evaluationEmphasis}}`,

      evaluationContext: `Analyze this {{languageName}} conversation between an Agent and Customer according to the provided evaluation rules.

PRIMARY LANGUAGE: {{languageName}} ({{language}})
Detection Confidence: {{confidence}}%
Configuration: {{configurationName}}

EVALUATION INSTRUCTIONS:
- Focus on professional communication standards
- Consider cultural and linguistic context
- Evaluate rule compliance thoroughly
- Provide specific, actionable recommendations

GLOBAL RULES (Apply to all languages):
{{globalRules}}

LANGUAGE-SPECIFIC RULES ({{languageName}} only):
{{languageSpecificRules}}

CONVERSATION TO ANALYZE:
{{conversation}}

Provide your analysis in the specified JSON format, paying special attention to language-specific cultural and communication patterns.`,

      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  getContexts(): PromptContext[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const contexts = JSON.parse(stored);
        // Ensure default context exists
        const hasDefault = contexts.some((c: PromptContext) => c.isDefault);
        if (!hasDefault) {
          contexts.unshift(this.getDefaultContext());
        }
        return contexts;
      }
    } catch (error) {
      console.error('Failed to load prompt contexts:', error);
    }
    
    // Return default context if nothing stored
    return [this.getDefaultContext()];
  }

  saveContext(context: PromptContext): void {
    const contexts = this.getContexts();
    const existingIndex = contexts.findIndex(c => c.id === context.id);
    
    if (existingIndex >= 0) {
      contexts[existingIndex] = { ...context, updatedAt: new Date().toISOString() };
    } else {
      contexts.push({ ...context, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contexts));
  }

  deleteContext(contextId: string): void {
    if (contextId === 'default') {
      throw new Error('Cannot delete default context');
    }
    
    const contexts = this.getContexts().filter(c => c.id !== contextId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contexts));
  }

  getContextById(contextId: string): PromptContext | null {
    return this.getContexts().find(c => c.id === contextId) || null;
  }

  interpolateContext(context: PromptContext, variables: PromptContextVariables): {
    systemPrompt: string;
    evaluationPrompt: string;
  } {
    const systemPrompt = this.interpolateTemplate(context.systemPromptContext, variables);
    const evaluationPrompt = this.interpolateTemplate(context.evaluationContext, variables);
    
    return { systemPrompt, evaluationPrompt };
  }

  private interpolateTemplate(template: string, variables: PromptContextVariables): string {
    let result = template;
    
    // Replace all variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    });
    
    return result;
  }

  getAvailableVariables(): Array<{ key: string; description: string }> {
    return [
      { key: '{{language}}', description: 'Language code (e.g., "en", "de")' },
      { key: '{{languageName}}', description: 'Full language name (e.g., "English", "German")' },
      { key: '{{confidence}}', description: 'Language detection confidence percentage' },
      { key: '{{configurationName}}', description: 'Name of the evaluation configuration' },
      { key: '{{globalRules}}', description: 'List of global evaluation rules' },
      { key: '{{languageSpecificRules}}', description: 'List of language-specific rules' },
      { key: '{{conversation}}', description: 'The full conversation to analyze' },
      { key: '{{culturalNotes}}', description: 'Cultural context for the language' },
      { key: '{{evaluationEmphasis}}', description: 'Special evaluation focus points' }
    ];
  }

  duplicateContext(contextId: string, newName: string): PromptContext {
    const original = this.getContextById(contextId);
    if (!original) {
      throw new Error('Context not found');
    }

    const duplicate: PromptContext = {
      ...original,
      id: `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveContext(duplicate);
    return duplicate;
  }
}

export const promptContextService = new PromptContextService();
