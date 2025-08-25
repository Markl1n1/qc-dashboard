
import { EvaluationRule, SupportedLanguage } from '../types/lemurEvaluation';
import { evaluationCategoriesService } from './evaluationCategoriesService';

class EvaluationRulesService {
  private storageKey = 'lemur_evaluation_rules';

  // Enhanced default rules with rule types and language-specific rules
  private defaultRules: EvaluationRule[] = [
    // CRITICAL CATEGORY RULES
    {
      id: 'critical_profane_language',
      name: 'Profane language',
      category: 'critical',
      description: 'Agent must not use any profane or inappropriate language',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Professional language only'],
        bad: ['Any profane words or inappropriate language']
      },
      priority: 'high'
    },
    {
      id: 'critical_insults_client',
      name: 'Insults toward the client',
      category: 'critical',
      description: 'Agent must never insult or disrespect the client',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Respectful communication'],
        bad: ['Insults, disrespectful comments']
      },
      priority: 'high'
    },
    {
      id: 'critical_informal_addressing',
      name: 'Addressing the client informally',
      category: 'critical',
      description: 'Agent must maintain formal addressing throughout the conversation',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Formal addressing, proper titles'],
        bad: ['Informal addressing, casual language']
      },
      priority: 'high'
    },
    {
      id: 'critical_ukrainian_words',
      name: 'Using Ukrainian words',
      category: 'critical',
      description: 'Agent must not use Ukrainian words in conversation',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Appropriate language for the conversation'],
        bad: ['Ukrainian words or phrases']
      },
      priority: 'high'
    },
    {
      id: 'critical_money_withdrawal_promise',
      name: 'Promising money withdrawal at any time',
      category: 'critical',
      description: 'Agent must not promise unrestricted money withdrawal',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Honest about withdrawal terms'],
        bad: ['You can withdraw anytime', 'Money available whenever you want']
      },
      priority: 'high'
    },
    {
      id: 'critical_guaranteeing_profit',
      name: 'Guaranteeing profit',
      category: 'critical',
      description: 'Agent must not guarantee profits or returns',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Discussing potential, risks included'],
        bad: ['Guaranteed profit', 'You will definitely make money']
      },
      priority: 'high'
    },
    {
      id: 'critical_no_risks_statement',
      name: 'Directly stating there are no risks',
      category: 'critical',
      description: 'Agent must not claim there are no risks involved',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Honest risk disclosure'],
        bad: ['No risks involved', 'Risk-free investment']
      },
      priority: 'high'
    },
    {
      id: 'critical_analyst_positioning',
      name: 'Positioning the analyst as an assistant or consultant',
      category: 'critical',
      description: 'Agent must not position themselves as assistant or consultant',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Proper role positioning'],
        bad: ['I am your assistant', 'As your consultant']
      },
      priority: 'high'
    },
    {
      id: 'critical_intimidating_client',
      name: 'Intimidating the client',
      category: 'critical',
      description: 'Agent must not use intimidation tactics',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Respectful persuasion'],
        bad: ['Threatening language', 'Intimidation tactics']
      },
      priority: 'high'
    },
    {
      id: 'critical_followup_without_objections',
      name: 'Letting the client go for a follow-up call without addressing objections',
      category: 'critical',
      description: 'Agent must address objections before agreeing to follow-up',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Addressing concerns before scheduling follow-up'],
        bad: ['Agreeing to follow-up without handling objections']
      },
      priority: 'high'
    },
    {
      id: 'critical_deposit_without_wallet',
      name: 'Leading the client to deposit without asking about a crypto wallet',
      category: 'critical',
      description: 'Agent must ask about crypto wallet before discussing deposit',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Do you have a crypto wallet?', 'What wallet do you use?'],
        bad: ['Just deposit the money', 'Start with a deposit']
      },
      priority: 'high'
    },
    {
      id: 'critical_ending_without_objections',
      name: 'Ending the conversation without handling objections',
      category: 'critical',
      description: 'Agent must handle all objections before ending conversation',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Addressing all concerns first'],
        bad: ['Ending call with unresolved objections']
      },
      priority: 'high'
    },
    {
      id: 'critical_interrupting_without_conclusion',
      name: 'Interrupting the conversation without a logical conclusion',
      category: 'critical',
      description: 'Agent must reach logical conclusion before ending',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Proper conversation closure'],
        bad: ['Abrupt conversation ending']
      },
      priority: 'high'
    },
    {
      id: 'critical_ending_without_agreement',
      name: 'Ending the conversation by the agent without an agreement',
      category: 'critical',
      description: 'Agent must not end conversation without reaching agreement',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Reaching mutual agreement'],
        bad: ['Agent ending call unilaterally']
      },
      priority: 'high'
    },

    // MISTAKE CATEGORY RULES
    {
      id: 'mistake_diminutive_words',
      name: 'Using diminutive or affectionate words',
      category: 'mistake',
      description: 'Agent should avoid using diminutive or overly affectionate language',
      weight: 0.8,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Professional language'],
        bad: ['Sweetie', 'Honey', 'Little deposit']
      },
      priority: 'medium'
    },
    {
      id: 'mistake_familiarity',
      name: 'Familiarity in communication',
      category: 'mistake',
      description: 'Agent should maintain professional distance',
      weight: 0.8,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Professional communication'],
        bad: ['buddy', 'bro', 'sweetie']
      },
      priority: 'medium'
    },
    {
      id: 'mistake_jargon_slang',
      name: 'Using jargon or slang',
      category: 'mistake',
      description: 'Agent should avoid jargon and slang terms',
      weight: 0.8,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Professional terminology'],
        bad: ['cash', 'easy money', 'jump in']
      },
      priority: 'medium'
    },
    {
      id: 'mistake_dialogue_structure',
      name: 'Not adhering to the dialogue structure',
      category: 'mistake',
      description: 'Agent should follow proper dialogue structure',
      weight: 0.9,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Following proper dialogue flow'],
        bad: ['Skipping dialogue steps', 'Poor structure']
      },
      priority: 'high'
    },

    // NOT RECOMMENDED CATEGORY RULES
    {
      id: 'not_recommended_filler_words',
      name: 'Parasitic words (filler words)',
      category: 'not_recommended',
      description: 'Agent should minimize use of filler words',
      weight: 0.5,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Clear, direct speech'],
        bad: ['um', 'uh', 'you know', 'like']
      },
      priority: 'low'
    },
    {
      id: 'not_recommended_hesitation',
      name: 'Agent stumbles or hesitates in speech',
      category: 'not_recommended',
      description: 'Agent should speak confidently without hesitation',
      weight: 0.6,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Confident, clear speech'],
        bad: ['Stumbling', 'Long pauses', 'Uncertain delivery']
      },
      priority: 'low'
    },

    // ALLOWED CATEGORY RULES  
    {
      id: 'allowed_analyst_titles',
      name: 'Referring to the analyst as a mentor, specialist, professional, trader, or analyst',
      category: 'allowed',
      description: 'These titles are acceptable for the analyst',
      weight: 0.7,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['mentor', 'specialist', 'professional', 'trader', 'analyst'],
        bad: ['assistant', 'consultant']
      },
      priority: 'medium'
    },

    // CORRECT CATEGORY RULES
    {
      id: 'correct_dialogue_structure',
      name: 'Conduct the dialogue according to the structure',
      category: 'correct',
      description: 'Agent must follow proper dialogue structure: Greeting, Information Gathering, Presentation, Objection Handling, News Selling, Closing',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Following complete dialogue structure'],
        bad: ['Skipping dialogue phases']
      },
      priority: 'high'
    },
    {
      id: 'correct_greeting',
      name: 'Proper greeting structure',
      category: 'correct',
      description: 'Agent must answer who is calling, where from, and why calling',
      weight: 0.9,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Hello, this is John from ABC Company, calling as your account manager'],
        bad: ['Hi there', 'Hello']
      },
      priority: 'high'
    },
    {
      id: 'correct_information_gathering',
      name: 'Complete information gathering',
      category: 'correct',
      description: 'Agent must gather information about: financial experience, relocation, profession, family, financial difficulties, financial goals, life goals',
      weight: 1.0,
      ruleType: 'global',
      required: true,
      examples: {
        good: ['Comprehensive information gathering'],
        bad: ['Incomplete information collection']
      },
      priority: 'high'
    },
    {
      id: 'correct_timing',
      name: 'Ideal dialogue timing',
      category: 'correct',
      description: 'Dialogue should be ~20 minutes: 5-10 minutes for greeting/information gathering, 3-5 minutes for presentation, rest for objection handling and closing',
      weight: 0.8,
      ruleType: 'global',
      required: false,
      examples: {
        good: ['Proper time management'],
        bad: ['Too rushed or too long phases']
      },
      priority: 'medium'
    }
  ];

  getRules(category?: string, language?: SupportedLanguage): EvaluationRule[] {
    const stored = this.getStoredRules();
    let filtered = stored;

    if (category) {
      filtered = filtered.filter(rule => rule.category === category);
    }

    if (language) {
      filtered = filtered.filter(rule => 
        rule.ruleType === 'global' || rule.language === language
      );
    }

    return filtered;
  }

  /**
   * Get global rules that apply to all languages
   */
  getGlobalRules(): EvaluationRule[] {
    return this.getStoredRules().filter(rule => rule.ruleType === 'global');
  }

  /**
   * Get language-specific rules for a particular language
   */
  getLanguageSpecificRules(language: SupportedLanguage): EvaluationRule[] {
    return this.getStoredRules().filter(rule => 
      rule.ruleType === 'language-specific' && rule.language === language
    );
  }

  /**
   * Get combined rules for a language (global + language-specific)
   */
  getCombinedRulesForLanguage(language: SupportedLanguage): EvaluationRule[] {
    const globalRules = this.getGlobalRules();
    const languageRules = this.getLanguageSpecificRules(language);
    return [...globalRules, ...languageRules];
  }

  getRulesByCategories(categories: string[]): EvaluationRule[] {
    const stored = this.getStoredRules();
    return stored.filter(rule => categories.includes(rule.category));
  }

  addRule(rule: EvaluationRule): void {
    const stored = this.getStoredRules();
    const updated = [...stored.filter(r => r.id !== rule.id), rule];
    this.saveRules(updated);
  }

  updateRule(ruleId: string, updates: Partial<EvaluationRule>): void {
    const stored = this.getStoredRules();
    const updated = stored.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    );
    this.saveRules(updated);
  }

  removeRule(ruleId: string): void {
    const stored = this.getStoredRules();
    const updated = stored.filter(rule => rule.id !== ruleId);
    this.saveRules(updated);
  }

  getRule(ruleId: string): EvaluationRule | null {
    const stored = this.getStoredRules();
    return stored.find(rule => rule.id === ruleId) || null;
  }

  getRulesByPriority(priority: 'high' | 'medium' | 'low'): EvaluationRule[] {
    return this.getStoredRules().filter(rule => rule.priority === priority);
  }

  getRequiredRules(): EvaluationRule[] {
    return this.getStoredRules().filter(rule => rule.required);
  }

  validateRule(rule: Partial<EvaluationRule>): string[] {
    const errors: string[] = [];

    if (!rule.name || rule.name.trim().length < 3) {
      errors.push('Rule name must be at least 3 characters long');
    }

    if (!rule.description || rule.description.trim().length < 10) {
      errors.push('Rule description must be at least 10 characters long');
    }

    if (rule.weight === undefined || rule.weight < 0 || rule.weight > 1) {
      errors.push('Rule weight must be between 0 and 1');
    }

    if (!rule.category) {
      errors.push('Rule category is required');
    } else {
      // Validate that category exists
      const availableCategories = evaluationCategoriesService.getCategories();
      if (!availableCategories.find(c => c.id === rule.category)) {
        errors.push('Selected category does not exist');
      }
    }

    if (!rule.ruleType) {
      errors.push('Rule type is required (global or language-specific)');
    }

    if (rule.ruleType === 'language-specific' && !rule.language) {
      errors.push('Language is required for language-specific rules');
    }

    if (!rule.examples || !rule.examples.good || rule.examples.good.length === 0) {
      errors.push('At least one good example is required');
    }

    return errors;
  }

  private getStoredRules(): EvaluationRule[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load evaluation rules from storage:', error);
    }
    
    // Return default rules if nothing stored
    return this.defaultRules;
  }

  private saveRules(rules: EvaluationRule[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rules));
    } catch (error) {
      console.error('Failed to save evaluation rules to storage:', error);
    }
  }

  initializeDefaults(): void {
    const stored = this.getStoredRules();
    if (stored.length === 0) {
      this.saveRules(this.defaultRules);
    }
  }

  exportRules(): string {
    return JSON.stringify(this.getStoredRules(), null, 2);
  }

  importRules(jsonData: string): void {
    try {
      const rules: EvaluationRule[] = JSON.parse(jsonData);
      
      // Validate all rules before importing
      const errors: string[] = [];
      rules.forEach((rule, index) => {
        const ruleErrors = this.validateRule(rule);
        if (ruleErrors.length > 0) {
          errors.push(`Rule ${index + 1}: ${ruleErrors.join(', ')}`);
        }
      });

      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join('; ')}`);
      }

      this.saveRules(rules);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Invalid JSON format for rules import');
    }
  }

  getStatistics(): {
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    byRuleType: Record<string, number>;
    byLanguage: Record<string, number>;
    required: number;
  } {
    const rules = this.getStoredRules();
    
    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byRuleType: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    rules.forEach(rule => {
      byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
      byPriority[rule.priority] = (byPriority[rule.priority] || 0) + 1;
      byRuleType[rule.ruleType] = (byRuleType[rule.ruleType] || 0) + 1;
      
      if (rule.language) {
        byLanguage[rule.language] = (byLanguage[rule.language] || 0) + 1;
      } else if (rule.ruleType === 'global') {
        byLanguage['global'] = (byLanguage['global'] || 0) + 1;
      }
    });

    return {
      total: rules.length,
      byCategory,
      byPriority,
      byRuleType,
      byLanguage,
      required: rules.filter(r => r.required).length
    };
  }

  createRuleTemplate(category: string, ruleType: 'global' | 'language-specific' = 'global', language?: SupportedLanguage): Partial<EvaluationRule> {
    return {
      id: `${ruleType}_${category}_${Date.now()}`,
      name: '',
      category,
      description: '',
      weight: 0.5,
      ruleType,
      language: ruleType === 'language-specific' ? language : undefined,
      required: false,
      examples: {
        good: [],
        bad: []
      },
      priority: 'medium'
    };
  }
}

export const evaluationRulesService = new EvaluationRulesService();
