import { AssemblyAI } from 'assemblyai';
import { SpeakerUtterance } from '../types';
import { 
  EvaluationConfiguration, 
  EvaluationCategory, 
  EvaluationRule,
  DEFAULT_CATEGORIES
} from '../types/evaluationCategories';
import { bannedWordsService } from './bannedWordsService';
import { simpleApiKeyService } from './simpleApiKeyService';
import { extractTextSnippet, cleanTextForAnalysis } from '../utils/textProcessing';

export interface SimpleEvaluationResult {
  overallScore: number; // 0-100
  categoryScores: Record<string, number>; // category ID -> score
  mistakes: EvaluationMistake[];
  ruleCompliance: Record<string, boolean>; // rule ID -> compliance
  bannedWordsDetected: BannedWordDetection[];
  recommendations: string[];
  summary: string;
  confidence: number;
  processingTime: number;
  configurationUsed: string;
  analysisId: string;
}

export interface EvaluationMistake {
  id: string;
  level: 'minor' | 'major' | 'critical';
  category: string;
  mistakeName?: string; // Short 3-4 word name for compact format
  description: string;
  text: string;
  position: number;
  speaker: 'Agent' | 'Customer';
  suggestion: string;
  ruleId?: string;
  confidence: number;
}

export interface BannedWordDetection {
  word: string;
  position: number;
  speaker: 'Agent' | 'Customer';
  category: string;
  severity: 'warning' | 'critical';
}

export interface EvaluationProgress {
  stage: 'initializing' | 'analyzing' | 'scoring' | 'complete' | 'error';
  progress: number;
  message: string;
}

class SimpleEvaluationService {
  private progressCallback?: (progress: EvaluationProgress) => void;
  private lastAttemptedModel: string = 'Simple Rule-Based Analysis';

  setProgressCallback(callback: (progress: EvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: EvaluationProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[SimpleEvaluation] ${stage}: ${progress}% - ${message}`);
  }

  async evaluateDialog(
    utterances: SpeakerUtterance[], 
    configuration: EvaluationConfiguration,
    transcriptId?: string
  ): Promise<SimpleEvaluationResult> {
    const apiKey = simpleApiKeyService.getAPIKey('assemblyai');
    if (!apiKey) {
      throw new Error(`AssemblyAI API key not found. Please configure your API key. Analysis method attempted: ${this.lastAttemptedModel}`);
    }

    this.updateProgress('initializing', 0, 'Starting evaluation...');

    try {
      const startTime = Date.now();

      // Step 1: Build evaluation prompt from configuration
      this.updateProgress('analyzing', 20, 'Building evaluation prompt...');
      const prompt = this.buildEvaluationPrompt(utterances, configuration);
      
      // Step 2: Call LeMUR for analysis (simulated for now)
      this.updateProgress('analyzing', 50, 'Analyzing conversation with LeMUR...');
      const lemurAnalysis = await this.callLeMURForAnalysis(prompt, utterances, configuration);

      // Step 3: Check for banned words locally
      this.updateProgress('scoring', 70, 'Checking banned words...');
      const bannedWordsDetected = this.checkBannedWords(utterances);

      // Step 4: Calculate scores using configuration weights
      this.updateProgress('scoring', 85, 'Calculating scores...');
      const result = this.calculateFinalScores(
        lemurAnalysis,
        bannedWordsDetected,
        configuration,
        Date.now() - startTime,
        utterances
      );

      this.updateProgress('complete', 100, 'Evaluation complete');
      return result;

    } catch (error) {
      console.error('[SimpleEvaluation] Failed:', error);
      
      let errorMessage = 'Simple evaluation failed';
      if (error instanceof Error) {
        errorMessage = `${error.message}. Analysis method attempted: ${this.lastAttemptedModel}`;
      }
      
      this.updateProgress('error', 0, errorMessage);
      
      // NO FALLBACK - Just throw the error with model information
      throw new Error(errorMessage);
    }
  }

  private buildEvaluationPrompt(utterances: SpeakerUtterance[], configuration: EvaluationConfiguration): string {
    const conversationText = utterances.map((u, index) => 
      `[${index}] ${u.speaker}: ${u.text}`
    ).join('\n');

    const enabledCategories = configuration.categories.filter(c => c.enabled);
    
    let prompt = `You are an expert conversation evaluator. Analyze this customer service dialog and identify issues according to the specified rules.

CONVERSATION:
${conversationText}

EVALUATION CATEGORIES AND RULES:
`;

    enabledCategories.forEach(category => {
      prompt += `\n${category.name.toUpperCase()} (${category.type} category, weight: ${category.weight}):\n`;
      
      if (category.rules.length > 0) {
        category.rules.filter(r => r.enabled).forEach(rule => {
          prompt += `- ${rule.name}: ${rule.description} (weight: ${rule.weight})\n`;
        });
      } else {
        prompt += `- No specific rules defined for this category\n`;
      }
    });

    prompt += `\nINSTRUCTIONS:
1. Analyze the conversation against each rule
2. Identify specific mistakes and violations
3. For each mistake, specify the category, severity level (minor/major/critical), and provide improvement suggestions
4. Return your analysis in JSON format with: mistakes, ruleCompliance, recommendations, summary

Return only valid JSON in this format:
{
  "mistakes": [
    {
      "id": "unique_id",
      "level": "minor|major|critical", 
      "category": "category_id",
      "description": "what went wrong",
      "text": "exact text from conversation",
      "position": utterance_index,
      "speaker": "Agent|Customer",
      "suggestion": "how to improve",
      "ruleId": "rule_id",
      "confidence": 85
    }
  ],
  "ruleCompliance": {
    "rule_id": true/false
  },
  "recommendations": ["specific coaching advice"],
  "summary": "overall assessment of conversation quality",
  "confidence": 90
}`;

    return prompt;
  }

  private async callLeMURForAnalysis(
    prompt: string, 
    utterances: SpeakerUtterance[], 
    configuration: EvaluationConfiguration
  ): Promise<any> {
    // Add debug logging
    console.log('[SimpleEvaluation] LeMUR Analysis Input:', {
      prompt: prompt.substring(0, 500) + '...',
      utterancesCount: utterances.length,
      configurationName: configuration.name
    });

    // Simulate LeMUR API call for now
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Analyze conversation based on rules
    const mistakes: any[] = [];
    const ruleCompliance: Record<string, boolean> = {};
    
    const conversationText = utterances.map(u => cleanTextForAnalysis(u.text)).join(' ').toLowerCase();
    
    // Check each rule in enabled categories
    configuration.categories.filter(c => c.enabled).forEach(category => {
      category.rules.filter(r => r.enabled).forEach(rule => {
        let compliant = true;
        let violationText = '';
        let violationPosition = 0;
        
        // Basic rule checking logic
        if (rule.name.toLowerCase().includes('greeting')) {
          compliant = conversationText.includes('hello') || conversationText.includes('good morning') || conversationText.includes('hi');
          if (!compliant) {
            violationText = 'No proper greeting found';
            violationPosition = 0;
          }
        } else if (rule.name.toLowerCase().includes('professional')) {
          const unprofessionalTerms = ['yeah', 'uh huh', 'whatever'];
          for (const term of unprofessionalTerms) {
            if (conversationText.includes(term)) {
              compliant = false;
              violationText = term;
              // Find position in utterances
              for (let i = 0; i < utterances.length; i++) {
                if (utterances[i].text.toLowerCase().includes(term)) {
                  violationPosition = i;
                  break;
                }
              }
              break;
            }
          }
        } else if (rule.name.toLowerCase().includes('question')) {
          compliant = (conversationText.match(/\?/g) || []).length >= 1;
          if (!compliant) {
            violationText = 'No questions asked to understand customer needs';
            violationPosition = Math.floor(utterances.length / 2);
          }
        }
        
        ruleCompliance[rule.id] = compliant;
        
        if (!compliant) {
          mistakes.push({
            id: `mistake_${rule.id}_${Date.now()}`,
            level: rule.weight >= 8 ? 'critical' : rule.weight >= 5 ? 'major' : 'minor',
            category: category.id,
            mistakeName: rule.name,
            description: rule.name,
            text: extractTextSnippet(utterances, violationPosition, violationText),
            position: violationPosition,
            speaker: 'Agent',
            suggestion: rule.description,
            ruleId: rule.id,
            confidence: 85
          });
        }
      });
    });

    const result = {
      mistakes,
      ruleCompliance,
      recommendations: [
        mistakes.length > 0 ? 'Address identified rule violations' : 'Good rule compliance overall',
        'Continue professional development training'
      ],
      summary: `Conversation analyzed against ${Object.keys(ruleCompliance).length} rules. ${mistakes.length} violations found.`,
      confidence: 88
    };

    // Add debug logging for the result
    console.log('[SimpleEvaluation] LeMUR Analysis Result:', {
      mistakesCount: result.mistakes.length,
      rulesChecked: Object.keys(result.ruleCompliance).length,
      confidence: result.confidence,
      mistakes: result.mistakes
    });

    return result;
  }

  private checkBannedWords(utterances: SpeakerUtterance[]): BannedWordDetection[] {
    const detections: BannedWordDetection[] = [];
    
    utterances.forEach((utterance, index) => {
      const bannedWordsInUtterance = bannedWordsService.checkUtterancesForBannedWords(
        [{ speaker: utterance.speaker, text: utterance.text }], 
        'en'
      );
      
      bannedWordsInUtterance.forEach(detection => {
        detection.bannedWords.forEach(word => {
          detections.push({
            word: word.word,
            position: index,
            speaker: utterance.speaker as 'Agent' | 'Customer',
            category: word.category,
            severity: word.severity
          });
        });
      });
    });
    
    return detections;
  }

  private calculateFinalScores(
    lemurAnalysis: any,
    bannedWordsDetected: BannedWordDetection[],
    configuration: EvaluationConfiguration,
    processingTime: number,
    utterances: SpeakerUtterance[]
  ): SimpleEvaluationResult {
    const categoryWeights = {
      'critical': 10,      // Critical mistakes: -10 points each
      'mistake': 7,        // Mistake level: -7 points each  
      'not_recommended': 3, // Not recommended: -3 points each
      'allowed': 0,        // Allowed: neutral (no penalty/bonus)
      'correct': 2         // Correct behavior: +2 bonus points each
    };

    // Add critical mistakes for banned words
    const bannedWordMistakes: EvaluationMistake[] = bannedWordsDetected.map((detection, index) => ({
      id: `banned_word_${index}`,
      level: 'critical' as const,
      category: 'critical',
      mistakeName: `Banned word: ${detection.word}`,
      description: `Used banned word: ${detection.word}`,
      text: extractTextSnippet(utterances, detection.position, detection.word),
      position: detection.position,
      speaker: detection.speaker,
      suggestion: 'Use appropriate professional language',
      confidence: 100
    }));

    const allMistakes = [...(lemurAnalysis.mistakes || []), ...bannedWordMistakes];

    // Start with 100 points and calculate deductions/bonuses
    let totalScore = 100;
    let totalDeductions = 0;
    let totalBonuses = 0;

    // Calculate category scores and overall deductions
    const categoryScores: Record<string, number> = {};
    const enabledCategories = configuration.categories.filter(c => c.enabled);
    
    enabledCategories.forEach(category => {
      const categoryMistakes = allMistakes.filter(m => m.category === category.id);
      let categoryScore = 100;
      let categoryDeductions = 0;

      // Calculate deductions for this category
      categoryMistakes.forEach(mistake => {
        const weight = categoryWeights[mistake.category as keyof typeof categoryWeights] || categoryWeights.mistake;
        categoryDeductions += weight;
        totalDeductions += weight;
      });

      // Apply deductions to category score
      categoryScore = Math.max(0, 100 - categoryDeductions);
      categoryScores[category.id] = Math.round(categoryScore);
    });

    // Calculate final overall score
    const finalScore = Math.max(0, Math.min(100, totalScore - totalDeductions + totalBonuses));

    console.log(`[Scoring] Started with ${totalScore} points, deducted ${totalDeductions}, added ${totalBonuses} bonus = ${finalScore}`);

    return {
      overallScore: finalScore,
      categoryScores,
      mistakes: allMistakes,
      ruleCompliance: lemurAnalysis.ruleCompliance || {},
      bannedWordsDetected,
      recommendations: lemurAnalysis.recommendations || [],
      summary: lemurAnalysis.summary || 'Evaluation completed',
      confidence: lemurAnalysis.confidence || 85,
      processingTime,
      configurationUsed: configuration.id,
      analysisId: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  validateApiKey(): boolean {
    const apiKey = simpleApiKeyService.getAPIKey('assemblyai');
    return Boolean(apiKey && apiKey.length > 20);
  }

  getDefaultConfiguration(): EvaluationConfiguration {
    return {
      id: 'default',
      name: 'Default Evaluation',
      description: 'Standard 6-category evaluation configuration',
      categories: DEFAULT_CATEGORIES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  getLastAttemptedModel(): string {
    return this.lastAttemptedModel;
  }
}

export const simpleEvaluationService = new SimpleEvaluationService();
