import { AssemblyAI } from 'assemblyai';
import { SpeakerUtterance } from '../types';
import { 
  EvaluationConfiguration, 
  LeMUREvaluationResult, 
  LeMUREvaluationProgress, 
  EvaluationMistake, 
  LeMURPromptTemplate,
  TokenUsageEstimate,
  SupportedLanguage 
} from '../types/lemurEvaluation';
import { LeMURRequest, LeMURResponse } from '../types/salesAnalysis';
import { bannedWordsService } from './bannedWordsService';
import { evaluationRulesService } from './evaluationRulesService';
import { evaluationCategoriesService } from './evaluationCategoriesService';
import { languageDetectionService, LanguageDetectionResult } from './languageDetectionService';
import { simpleApiKeyService } from './simpleApiKeyService';
import { LEMUR_MODELS, AssemblyAIRegion, ASSEMBLYAI_REGIONS } from '../components/LeMURModelSelector';
import { formatDialogForCopy } from '../utils/dialogFormatting';

// Updated model mapping to correctly use Claude 4 models
const LEMUR_MODEL_MAPPING: Record<string, string> = {
  'anthropic/claude-opus-4-20250514': 'claude-3-opus', // Use best available until Claude 4 is in LeMUR
  'anthropic/claude-sonnet-4-20250514': 'claude-3-5-sonnet', // Use best available until Claude 4 is in LeMUR
  'anthropic/claude-3-7-sonnet-20250219': 'claude-3-5-sonnet',
  'anthropic/claude-3-5-sonnet': 'claude-3-5-sonnet',
  'anthropic/claude-3-5-haiku-20241022': 'claude-3-haiku',
  'anthropic/claude-3-opus': 'claude-3-opus',
  'anthropic/claude-3-haiku': 'claude-3-haiku'
};

interface DefaultConfigurationService {
  getDefaultConfiguration(): EvaluationConfiguration;
}

class LeMUREvaluationService implements DefaultConfigurationService {
  private progressCallback: ((progress: LeMUREvaluationProgress) => void) | null = null;
  private assemblyAIClient: AssemblyAI | null = null;
  private lastAttemptedModel: string = '';

  constructor() {
    this.initializeAssemblyAIClient();
  }

  private initializeAssemblyAIClient() {
    const apiKey = simpleApiKeyService.getAPIKey('assemblyai');
    if (apiKey) {
      this.assemblyAIClient = new AssemblyAI({ apiKey });
    }
  }

  setProgressCallback(callback: (progress: LeMUREvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: LeMUREvaluationProgress['stage'], progress: number, message: string, currentStep?: string) {
    if (this.progressCallback) {
      this.progressCallback({ 
        stage, 
        progress, 
        message, 
        currentStep,
        estimatedTimeRemaining: this.calculateTimeRemaining(progress)
      });
    }
    console.log(`[LeMUR Evaluation] ${stage}: ${progress}% - ${message}`);
  }

  private calculateTimeRemaining(progress: number): number {
    const baseTime = 45;
    const remaining = ((100 - progress) / 100) * baseTime;
    return Math.max(0, remaining);
  }

  getDefaultConfiguration(): EvaluationConfiguration {
    return {
      id: 'default',
      name: 'Default Evaluation',
      description: 'Standard customer service evaluation configuration',
      rules: evaluationRulesService.getRules(),
      bannedWords: bannedWordsService.getBannedWords(),
      categories: evaluationCategoriesService.getCategories(),
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
  }

  private preprocessBannedWords(utterances: SpeakerUtterance[], language: SupportedLanguage) {
    const detectedWords = bannedWordsService.checkUtterancesForBannedWords(
      utterances.map(u => ({ speaker: u.speaker, text: u.text })), 
      language
    );

    return detectedWords.flatMap(detection => detection.bannedWords);
  }

  // UNIFIED prompt building method - this is the single source of truth
  private buildUnifiedEvaluationPrompt(
    configuration: EvaluationConfiguration, 
    languageDetection: LanguageDetectionResult,
    utterances: SpeakerUtterance[]
  ): string {
    const enabledCategories = configuration.categories.filter(c => c.enabled);
    const selectedRules = configuration.rules;
    const languageName = languageDetectionService.getLanguageName(languageDetection.primaryLanguage);

    let promptSections = [];

    // Add main header
    promptSections.push(`You are an expert conversation evaluator analyzing a customer service dialog in ${languageName}.`);

    // Add categories and rules
    promptSections.push(`\nEVALUATION CATEGORIES AND RULES:`);
    
    enabledCategories.forEach(category => {
      const categoryRules = selectedRules.filter(rule => rule.category === category.id);
      
      if (categoryRules.length > 0) {
        promptSections.push(`- ${category.name}:`);
        categoryRules.forEach(rule => {
          const ruleType = rule.ruleType === 'language-specific' ? 
            ` [${rule.language?.toUpperCase()}]` : '';
          promptSections.push(`   • ${rule.name}${ruleType}: ${rule.description}`);
        });
      }
    });

    // Add conversation using the same format as Copy button
    const conversationText = formatDialogForCopy(utterances);

    promptSections.push(`\nCONVERSATION TO ANALYZE:`);
    promptSections.push(conversationText);

    // Add JSON output structure - simplified format
    promptSections.push(`\nAnalyze the conversation and identify specific mistakes. For each mistake found, provide:`);
    promptSections.push(`- The exact text from the conversation`);
    promptSections.push(`- Which rule category it violates`);
    promptSections.push(`- A short descriptive name (3-4 words)`);
    promptSections.push(`- Your confidence level`);
    promptSections.push(`\nReturn JSON format:`);
    promptSections.push(`{
  "mistakes": [
    {
      "id": "unique_id",
      "category": "rule_category", 
      "mistakeName": "short 3-4 word name",
      "text": "exact text from conversation",
      "confidence": number (0-100)
    }
  ]
}`);

    return promptSections.join('\n');
  }

  private buildLanguageAwarePromptTemplate(
    configuration: EvaluationConfiguration, 
    languageDetection: LanguageDetectionResult,
    selectedModel?: string
  ): LeMURPromptTemplate {
    // Get the correct LeMUR model name from SDK parameter
    const modelData = LEMUR_MODELS.find(m => m.id === selectedModel);
    const sdkModelParameter = modelData?.sdkParameter || 'anthropic/claude-3-haiku';
    const lemurModelName = LEMUR_MODEL_MAPPING[sdkModelParameter] || 'claude-3-haiku';
    
    // Store the attempted model for error reporting
    this.lastAttemptedModel = modelData?.name || lemurModelName;
    
    console.log(`[LeMUR] Using model: ${lemurModelName} (from SDK: ${sdkModelParameter})`);

    return {
      systemPrompt: '', // Keep empty for unified approach
      evaluationPrompt: '', // Will be filled by buildUnifiedEvaluationPrompt
      outputFormat: 'json',
      model: lemurModelName as LeMURPromptTemplate['model'],
      maxTokens: 4000,
      temperature: 0.1,
      language: languageDetection.primaryLanguage
    };
  }

  // Fixed LeMUR API call implementation with proper CORS handling
  private async callRealLeMUREvaluationAPI(
    transcriptId: string,
    prompt: string,
    template: LeMURPromptTemplate,
    selectedRegion?: AssemblyAIRegion
  ): Promise<string> {
    console.log(`[REAL LeMUR API] Processing transcript: ${transcriptId}`);
    console.log(`[REAL LeMUR API] Using model: ${template.model}`);
    console.log(`[REAL LeMUR API] Prompt length: ${prompt.length} characters`);
    console.log(`[REAL LeMUR API] Region: ${selectedRegion || 'US'}`);

    if (!this.assemblyAIClient) {
      throw new Error('AssemblyAI client not initialized. Please check your API key.');
    }

    try {
      // IMPORTANT: Use the AssemblyAI SDK which handles CORS properly
      // The SDK internally uses server-side compatible methods
      console.log(`[REAL LeMUR API] Using AssemblyAI SDK for LeMUR call...`);

      const response = await this.assemblyAIClient.lemur.task({
        transcript_ids: [transcriptId],
        prompt: prompt,
        final_model: template.model,
        max_output_size: template.maxTokens,
        temperature: template.temperature
      });

      console.log(`[REAL LeMUR API] Response received:`, response);
      
      if (!response.response) {
        throw new Error('Empty response from LeMUR API');
      }
      
      return response.response;

    } catch (error) {
      console.error(`[REAL LeMUR API] Error:`, error);
      
      // Enhanced error handling for CORS and other issues
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('cors') || errorMessage.includes('fetch')) {
          console.log(`[REAL LeMUR API] CORS error detected`);
          throw new Error(`CORS Error: LeMUR API cannot be called directly from the browser. For production use, please implement a backend proxy server or use Supabase Edge Functions. Model attempted: ${this.lastAttemptedModel}`);
        } else if (errorMessage.includes('transcript not found')) {
          throw new Error(`Transcript ${transcriptId} not found. Please ensure you have a valid transcript ID from AssemblyAI. Model attempted: ${this.lastAttemptedModel}`);
        } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
          throw new Error(`Invalid AssemblyAI API key. Please check your API key configuration. Model attempted: ${this.lastAttemptedModel}`);
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('429')) {
          throw new Error(`API quota exceeded. Please check your AssemblyAI account limits. Model attempted: ${this.lastAttemptedModel}`);
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          throw new Error(`Network error occurred. Please check your internet connection and try again. Model attempted: ${this.lastAttemptedModel}`);
        }
      }
      
      // For any other error, provide detailed error information
      throw new Error(`LeMUR API call failed: ${error instanceof Error ? error.message : 'Unknown error'}. Model attempted: ${this.lastAttemptedModel}`);
    }
  }

  async evaluateDialog(
    utterances: SpeakerUtterance[], 
    configuration: EvaluationConfiguration,
    transcriptId?: string,
    language: SupportedLanguage = 'en',
    assemblyAIResult?: any,
    manualLanguageOverride?: SupportedLanguage,
    customContextId?: string,
    selectedModel?: string,
    selectedRegion?: AssemblyAIRegion
  ): Promise<LeMUREvaluationResult> {
    // Ensure AssemblyAI client is initialized
    if (!this.assemblyAIClient) {
      this.initializeAssemblyAIClient();
      if (!this.assemblyAIClient) {
        throw new Error('AssemblyAI API key not configured. Please add your API key to use LeMUR evaluation.');
      }
    }

    // Require transcript ID for real API calls
    if (!transcriptId) {
      throw new Error('Transcript ID is required for LeMUR evaluation. Please ensure you have uploaded and transcribed an audio file first.');
    }

    this.updateProgress('initializing', 0, 'Initializing LeMUR evaluation...', 'Setup');

    try {
      const startTime = Date.now();

      // Step 1: Language Detection
      this.updateProgress('preprocessing', 5, 'Detecting conversation language...', 'Language Detection');
      const conversationText = utterances.map(u => u.text).join(' ');
      const languageDetection = languageDetectionService.detectLanguage(
        conversationText,
        assemblyAIResult,
        manualLanguageOverride
      );

      console.log(`[LeMUR] Detected language: ${languageDetection.primaryLanguage} (confidence: ${languageDetection.confidence})`);

      // Step 2: Get Language-Specific Rules
      this.updateProgress('preprocessing', 10, 'Loading language-specific rules...', 'Rule Selection');
      const applicableRules = evaluationRulesService.getCombinedRulesForLanguage(languageDetection.primaryLanguage);
      
      const configRules = applicableRules.filter(rule => 
        configuration.rules.some(configRule => configRule.id === rule.id)
      );

      console.log(`[LeMUR] Using ${configRules.length} rules`);

      // Step 3: Preprocessing - detect banned words
      this.updateProgress('preprocessing', 15, 'Checking for banned words...', 'Pre-analysis');
      const bannedWordsDetected = this.preprocessBannedWords(utterances, languageDetection.primaryLanguage);

      // Step 4: Build unified prompt
      this.updateProgress('preprocessing', 20, 'Building evaluation prompt...', 'Prompt Construction');
      const promptTemplate = this.buildLanguageAwarePromptTemplate(
        configuration, 
        languageDetection, 
        selectedModel
      );
      
      // Use the unified prompt building method
      const prompt = this.buildUnifiedEvaluationPrompt(configuration, languageDetection, utterances);

      // Step 5: Estimate token usage
      const tokenEstimate = this.estimateTokenUsage(prompt, promptTemplate);
      console.log('Token usage estimate:', tokenEstimate);

      // Step 6: Call real LeMUR API - NO FALLBACK TO DEMO DATA
      this.updateProgress('analyzing', 30, `Analyzing with ${promptTemplate.model}...`, 'AI Analysis');
      
      const lemurResponse = await this.callRealLeMUREvaluationAPI(transcriptId, prompt, promptTemplate, selectedRegion);

      this.updateProgress('analyzing', 70, 'Processing response...', 'Response Processing');

      // Step 7: Parse and enhance results
      this.updateProgress('post_processing', 80, 'Enhancing analysis results...', 'Enhancement');
      const result = this.parseEvaluationResponse(
        lemurResponse,
        utterances,
        configuration,
        bannedWordsDetected,
        tokenEstimate,
        Date.now() - startTime,
        languageDetection.primaryLanguage
      );

      this.updateProgress('complete', 100, 'Evaluation completed successfully', 'Complete');

      return result;

    } catch (error) {
      console.error('[LeMUR Evaluation] Failed:', error);
      
      let errorMessage = 'LeMUR evaluation failed';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      this.updateProgress('error', 0, errorMessage, 'Error');
      
      // NO FALLBACK - Just throw the error with model information
      throw new Error(errorMessage);
    }
  }

  private estimateTokenUsage(prompt: string, template: LeMURPromptTemplate): TokenUsageEstimate {
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = template.maxTokens;
    
    const costs = {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 }
    };

    const modelCosts = costs[template.model as keyof typeof costs] || costs['claude-3-haiku'];
    const estimatedCost = (estimatedInputTokens / 1000) * modelCosts.input + 
                         (estimatedOutputTokens / 1000) * modelCosts.output;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost,
      model: template.model
    };
  }

  private parseEvaluationResponse(
    response: string,
    utterances: SpeakerUtterance[],
    configuration: EvaluationConfiguration,
    bannedWordsDetected: any[],
    tokenEstimate: TokenUsageEstimate,
    processingTime: number,
    detectedLanguage: SupportedLanguage
  ): LeMUREvaluationResult {
    console.log('=== LeMUR RESPONSE DEBUG ===');
    console.log('Raw LeMUR Response:', response);
    
    // Category to level mapping
    const levelMapping: Record<string, 'minor' | 'major' | 'critical'> = {
      'critical': 'critical',
      'mistake': 'major',
      'not_recommended': 'minor',
      'allowed': 'minor',
      'correct': 'minor'
    };
    
    try {
      let jsonString = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[1] || jsonMatch[0];
      }

      const parsed = JSON.parse(jsonString);
      
      console.log('=== PARSED LeMUR RESPONSE ===');
      console.log('Parsed Response:', parsed);

      // Process mistakes and add missing fields, finding actual positions in utterances
      const processedMistakes = (parsed.mistakes || []).map((mistake: any, index: number) => {
        // Find the utterance position that contains this mistake text
        let position = 0;
        let speaker: 'Agent' | 'Customer' = 'Agent';
        
        for (let i = 0; i < utterances.length; i++) {
          if (utterances[i].text.toLowerCase().includes(mistake.text.toLowerCase())) {
            position = i;
            speaker = utterances[i].speaker as 'Agent' | 'Customer';
            break;
          }
        }

        return {
          id: mistake.id || `mistake_${index}`,
          level: levelMapping[mistake.category] || 'minor',
          category: mistake.category,
          mistakeName: mistake.mistakeName || mistake.category || 'Rule violation detected',
          description: mistake.mistakeName || mistake.category || 'Rule violation detected',
          text: mistake.text,
          position: position,
          speaker: speaker,
          suggestion: `Address the ${mistake.category} issue identified`,
          impact: levelMapping[mistake.category] === 'critical' ? 'high' : 
                 levelMapping[mistake.category] === 'major' ? 'medium' : 'low',
          confidence: mistake.confidence || 85
        };
      });

      // Add critical mistakes for banned words
      const bannedWordMistakes: EvaluationMistake[] = bannedWordsDetected.map((word, index) => ({
        id: `banned_word_${index}`,
        level: 'critical',
        category: 'general',
        mistakeName: `Banned word: ${word.word}`,
        description: `Used banned word: ${word.word}`,
        text: word.word,
        position: 0,
        speaker: 'Agent',
        suggestion: word.replacement || 'Use appropriate professional language',
        impact: 'high',
        confidence: 100
      }));

      const allMistakes = [...processedMistakes, ...bannedWordMistakes];
      
      // Calculate score based on mistakes (since overallScore is no longer provided)
      const criticalCount = allMistakes.filter(m => m.level === 'critical').length;
      const majorCount = allMistakes.filter(m => m.level === 'major').length;
      const minorCount = allMistakes.filter(m => m.level === 'minor').length;
      
      const calculatedScore = Math.max(0, 100 - (criticalCount * 10) - (majorCount * 5) - (minorCount * 2));

      // Generate category scores based on mistakes
      const categoryScores: Record<string, number> = {};
      configuration.categories.forEach(category => {
        const categoryMistakes = allMistakes.filter(m => m.category === category.id);
        const categoryScore = Math.max(0, 100 - (categoryMistakes.length * 10));
        categoryScores[category.id] = categoryScore;
      });

      const result = {
        overallScore: calculatedScore,
        categoryScores: categoryScores,
        mistakes: allMistakes,
        ruleCompliance: {},
        bannedWordsDetected,
        recommendations: [],
        summary: `LeMUR analysis complete. Found ${allMistakes.length} issues in conversation.`,
        confidence: 85,
        processingTime,
        tokenUsage: {
          input: tokenEstimate.estimatedInputTokens,
          output: tokenEstimate.estimatedOutputTokens,
          cost: tokenEstimate.estimatedCost
        },
        configurationUsed: configuration.id,
        analysisId: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        detectedLanguage
      };
      
      console.log('=== FINAL RESULT ===');
      console.log('Final LeMUR Result:', result);
      
      return result;

    } catch (error) {
      console.error('=== LeMUR RESPONSE PARSING ERROR ===');
      console.error('Failed to parse LeMUR response:', error);
      
      return {
        overallScore: 70,
        categoryScores: {},
        mistakes: [],
        ruleCompliance: {},
        bannedWordsDetected,
        recommendations: [],
        summary: 'LeMUR evaluation completed but response parsing failed',
        confidence: 50,
        processingTime,
        tokenUsage: {
          input: tokenEstimate.estimatedInputTokens,
          output: tokenEstimate.estimatedOutputTokens,
          cost: tokenEstimate.estimatedCost
        },
        configurationUsed: configuration.id,
        analysisId: `eval_fallback_${Date.now()}`,
        detectedLanguage
      };
    }
  }

  validateApiKey(): boolean {
    const apiKey = simpleApiKeyService.getAPIKey('assemblyai');
    return Boolean(apiKey && apiKey.length > 20);
  }

  getModelCapabilities(): Record<string, { maxTokens: number; cost: string; speed: string }> {
    return {
      'claude-3-opus': { maxTokens: 200000, cost: 'High', speed: 'Slow' },
      'claude-3-5-sonnet': { maxTokens: 200000, cost: 'Medium', speed: 'Fast' },
      'claude-3-haiku': { maxTokens: 200000, cost: 'Low', speed: 'Very Fast' }
    };
  }

  // Updated method to use the unified prompt system with real utterances
  getCustomEvaluationPromptTemplate(configuration: EvaluationConfiguration, utterances?: SpeakerUtterance[]): string {
    // Create a mock language detection for preview
    const mockLanguageDetection: LanguageDetectionResult = {
      primaryLanguage: 'en',
      confidence: 1.0,
      detectionMethod: 'manual',
      alternativeLanguages: [{ language: 'en', confidence: 1.0 }]
    };

    // Use provided utterances or create minimal mock utterances for preview
    const previewUtterances: SpeakerUtterance[] = utterances || [
      { speaker: 'Agent', text: 'Hello, how can I help you today?', start: 0, end: 3, confidence: 0.95 },
      { speaker: 'Customer', text: 'I need help with my account', start: 4, end: 7, confidence: 0.93 }
    ];

    // Use the unified prompt building method - this is now 1:1 with actual evaluation
    return this.buildUnifiedEvaluationPrompt(configuration, mockLanguageDetection, previewUtterances);
  }

  getLastAttemptedModel(): string {
    return this.lastAttemptedModel;
  }
}

export const lemurEvaluationService = new LeMUREvaluationService();
