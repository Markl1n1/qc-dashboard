
import { supabase } from '../integrations/supabase/client';
import { logger } from './loggingService';
import { aiInstructionsService } from './aiInstructionsService';
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress } from '../types/openaiEvaluation';

interface Settings {
  aiConfidenceThreshold: number;
  aiEvaluationModel: string;
}

interface EvaluationParams {
  dialogId: string;
  text: string;
  speakerUtterances: SpeakerUtterance[];
  settings: Settings;
  progressCallback: (progress: OpenAIEvaluationProgress) => void;
}

class OpenAIEvaluationService {
  private model: string | null = null;
  private confidenceThreshold: number = 0.75;
  private progressCallback: ((progress: OpenAIEvaluationProgress) => void) | null = null;

  async initialize(): Promise<void> {
    try {
      const config = await this.fetchSettings();
      this.model = config.aiEvaluationModel;
      this.confidenceThreshold = config.aiConfidenceThreshold;
    } catch (error) {
      logger.error('Failed to initialize OpenAI Evaluation Service', error);
      throw new Error('Failed to initialize OpenAI Evaluation Service');
    }
  }

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void): void {
    this.progressCallback = callback;
  }

  async evaluateConversation(utterances: SpeakerUtterance[], model: string): Promise<OpenAIEvaluationResult> {
    const startTime = Date.now();
    const text = utterances.map(u => `${u.speaker}: ${u.text}`).join('\n');
    
    try {
      console.log('🚀 Starting OpenAI evaluation with model:', model);
      console.log('📊 Input utterances count:', utterances.length);
      
      this.progressCallback?.({ stage: 'initializing', message: 'Preparing evaluation', progress: 0 });

      const instructions = await aiInstructionsService.getLatestInstructions('evaluation') || 'Please evaluate this conversation.';
      const prompt = this.constructPrompt(text, utterances, instructions);
      console.log('📝 Generated prompt length:', prompt.length);

      this.progressCallback?.({ stage: 'analyzing', message: 'Sending to OpenAI for analysis', progress: 0.1 });

      console.log('📤 Calling OpenAI edge function...');
      const evaluation = await this.callOpenAIEdgeFunction(prompt, model);
      console.log('📥 Received evaluation response:', evaluation);

      this.progressCallback?.({ stage: 'processing_response', message: 'Processing OpenAI response', progress: 0.6 });

      const parsedResult = this.parseOpenAIResponse(evaluation);

      this.progressCallback?.({ stage: 'processing_response', message: 'Parsing complete', progress: 0.8 });

      const validatedResult = this.validateResult(parsedResult, this.confidenceThreshold);
      
      // Add missing fields
      const finalResult: OpenAIEvaluationResult = {
        ...validatedResult,
        processingTime: Date.now() - startTime,
        modelUsed: model,
        analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      logger.info(`OpenAI evaluation completed`);
      this.progressCallback?.({ stage: 'complete', message: 'Evaluation complete', progress: 1 });

      return finalResult;
    } catch (error: any) {
      this.progressCallback?.({ stage: 'error', message: error.message, progress: 0 });
      await this.handleApiError(error, 'evaluate');
      throw error;
    }
  }

  private async fetchSettings(): Promise<Settings> {
    const aiConfidenceThreshold = await supabase.from('system_config').select('value').eq('key', 'ai_confidence_threshold').single();
    const aiEvaluationModel = await supabase.from('system_config').select('value').eq('key', 'ai_evaluation_model').single();

    return {
      aiConfidenceThreshold: aiConfidenceThreshold.data?.value ? parseFloat(aiConfidenceThreshold.data.value) : 0.75,
      aiEvaluationModel: aiEvaluationModel.data?.value || 'gpt-5-2025-08-07',
    };
  }

  async evaluate(params: EvaluationParams): Promise<OpenAIEvaluationResult> {
    try {
      const { dialogId, text, speakerUtterances, settings, progressCallback } = params;

      progressCallback({ stage: 'initializing', message: 'Preparing evaluation', progress: 0 });

      const instructions = await aiInstructionsService.getLatestInstructions('evaluation') || 'Please evaluate this conversation.';
      const prompt = this.constructPrompt(text, speakerUtterances, instructions);

      progressCallback({ stage: 'analyzing', message: 'Sending to OpenAI for analysis', progress: 0.1 });

      const evaluation = await this.callOpenAIEdgeFunction(prompt, settings.aiEvaluationModel);

      progressCallback({ stage: 'processing_response', message: 'Processing OpenAI response', progress: 0.6 });

      const parsedResult = this.parseOpenAIResponse(evaluation);

      progressCallback({ stage: 'processing_response', message: 'Parsing complete', progress: 0.8 });

      const validatedResult = this.validateResult(parsedResult, settings.aiConfidenceThreshold);

      progressCallback({ stage: 'complete', message: 'Validation complete', progress: 0.9 });

      logger.info(`OpenAI evaluation completed for dialog ${dialogId}`);
      progressCallback({ stage: 'complete', message: 'Evaluation complete', progress: 1 });

      return validatedResult;
    } catch (error: any) {
      await this.handleApiError(error, 'evaluate');
      throw error;
    }
  }

  private constructPrompt(text: string, speakerUtterances: SpeakerUtterance[], instructions: string): string {
    const speakerLines = speakerUtterances.map(u => `${u.speaker}: ${u.text}`).join('\n');

    const basePrompt = `${instructions}

You must respond in the following JSON format:
{
  "score": <int>,                 // итоговая оценка (1-100)
  "mistakes": [
    {
      "rule_category": "Correct|Acceptable|Not Recommended|Mistake|Banned",
      "comment": "<string>", // comment from analysis
      "utterance": "<string>" // agent utterance where mistake found
    }
  ],
  "speakers": [
    {
      "speaker_0": "<string>", // name of speaker if defined
      "role_0": "<string>", // role of speaker 0 (Agent or Customer)
      "speaker_1": "<string>", // name of speaker if defined
      "role_1": "<string>", // role of speaker 1 (Agent or Customer)
    }
  ]
}
      
      Transcription:
      ${speakerLines}
      
      Summary:
      ${text}
      `;

    // Optimize prompt length if it's too long
    return this.optimizePromptLength(basePrompt);
  }

  private async callOpenAIEdgeFunction(prompt: string, model: string, retryCount = 0): Promise<any> {
    try {
      // Calculate optimal token count based on prompt length
      const promptTokens = Math.ceil(prompt.length / 4); // Rough estimation: 4 chars per token
      const maxTokens = this.calculateOptimalTokens(promptTokens, model);
      
      // Determine if this is a GPT-5 or newer model that requires different parameters
      const isGPT5OrNewer = model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4');
      
      console.log(`📊 Token calculation - Prompt: ${promptTokens}, Max output: ${maxTokens}, Model: ${model}`);
      
      const requestBody: any = {
        model: model,
        messages: [{ role: "user", content: prompt }],
      };

      // For GPT-5 and newer models, use max_completion_tokens and reasoning_effort
      if (isGPT5OrNewer) {
        requestBody.max_output_tokens = maxTokens;
        if (model.includes('o3') || model.includes('o4')) {
          requestBody.reasoning_effort = 'medium';
        }
        // Note: temperature is not supported for GPT-5 and newer models
      } else {
        // For legacy models (gpt-4o family), use max_tokens and temperature
        requestBody.max_output_tokens = maxTokens;
        requestBody.temperature = 0.7;
      }

      const { data, error } = await supabase.functions.invoke('openai-evaluate', {
        body: requestBody,
      });

      if (error) {
        logger.error('OpenAI Edge Function error', error);
        throw new Error(`OpenAI evaluation failed: ${error.message}`);
      }

      if (data.error) {
        logger.error('OpenAI API error from edge function', data.error);
        throw new Error(`OpenAI API error: ${data.error}`);
      }

      // Check for truncated response and retry with higher token limit
      if (data.choices?.[0]?.finish_reason === 'length' && retryCount < 2) {
        console.log(`⚠️ Response truncated, retrying with higher token limit (attempt ${retryCount + 1})`);
        const higherTokenModel = this.selectHigherCapacityModel(model);
        if (higherTokenModel !== model) {
          console.log(`🔄 Switching to higher capacity model: ${higherTokenModel}`);
          return this.callOpenAIEdgeFunction(prompt, higherTokenModel, retryCount + 1);
        } else {
          // Same model, just increase tokens
          return this.callOpenAIEdgeFunction(prompt, model, retryCount + 1);
        }
      }

      return data;
    } catch (error: any) {
      logger.error('Error calling OpenAI edge function', error);
      throw error;
    }
  }

  private calculateOptimalTokens(promptTokens: number, model: string): number {
    // Base token limits
    const baseTokens = model.includes('mini') ? 2000 : 4000;
    
    // Increase tokens for complex analysis (long conversations)
    if (promptTokens > 8000) {
      return Math.min(8000, baseTokens * 2);
    } else if (promptTokens > 4000) {
      return Math.min(6000, baseTokens * 1.5);
    }
    
    return baseTokens;
  }

  private selectHigherCapacityModel(currentModel: string): string {
    // Model upgrade path for better performance
    const modelUpgrades: Record<string, string> = {
      'gpt-5-mini-2025-08-07': 'gpt-5-2025-08-07',
      'gpt-5-nano-2025-08-07': 'gpt-5-mini-2025-08-07',
      'gpt-4.1-mini-2025-04-14': 'gpt-4.1-2025-04-14',
      'o4-mini-2025-04-16': 'o3-2025-04-16'
    };
    
    return modelUpgrades[currentModel] || currentModel;
  }

  private optimizePromptLength(prompt: string, maxLength = 50000): string {
    if (prompt.length <= maxLength) return prompt;
    
    console.log(`📝 Optimizing prompt length from ${prompt.length} to ~${maxLength} characters`);
    
    // Extract key sections
    const instructionsMatch = prompt.match(/(.*?)Transcription:/s);
    const transcriptionMatch = prompt.match(/Transcription:\s*([\s\S]*?)\s*Summary:/);
    const summaryMatch = prompt.match(/Summary:\s*([\s\S]*)$/);
    
    if (!instructionsMatch || !transcriptionMatch) return prompt;
    
    const instructions = instructionsMatch[1];
    const transcription = transcriptionMatch[1];
    const summary = summaryMatch?.[1] || '';
    
    // Truncate transcription if needed
    const availableSpace = maxLength - instructions.length - summary.length - 200; // Buffer
    let optimizedTranscription = transcription;
    
    if (transcription.length > availableSpace) {
      const lines = transcription.split('\n');
      const keepFirst = Math.floor(lines.length * 0.3);
      const keepLast = Math.floor(lines.length * 0.3);
      
      optimizedTranscription = [
        ...lines.slice(0, keepFirst),
        '... [middle section truncated for analysis] ...',
        ...lines.slice(-keepLast)
      ].join('\n');
      
      console.log(`✂️ Truncated transcription from ${lines.length} to ${keepFirst + keepLast} lines`);
    }
    
    return `${instructions}Transcription:\n${optimizedTranscription}\n\nSummary:\n${summary}`;
  }

  private parseOpenAIResponse(response: any): OpenAIEvaluationResult {
    try {
      console.log('🔍 OpenAI Raw Response:', JSON.stringify(response, null, 2));
      
      if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
        logger.error('Invalid OpenAI response structure');
        throw new Error('Invalid OpenAI response structure');
      }

      const choice = response.choices[0];
      const content = choice.message.content;
      const finishReason = choice.finish_reason;
      
      console.log('📝 OpenAI Content:', content);
      console.log('🏁 Finish Reason:', finishReason);
      
      // Handle truncated responses
      if (finishReason === 'length') {
        console.warn('⚠️ Response was truncated due to token limit');
        if (!content) {
          throw new Error('Response truncated with no content - increase token limit and retry');
        }
      }
      
      if (!content) {
        const errorMsg = finishReason === 'length' 
          ? 'Response truncated - no content returned' 
          : 'No content in OpenAI response';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Try to clean content if it has markdown formatting
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🧹 Cleaned Content:', cleanContent);

      // Handle partial JSON for truncated responses
      if (finishReason === 'length' && !this.isValidJSON(cleanContent)) {
        console.log('🔧 Attempting to fix truncated JSON...');
        cleanContent = this.attemptJSONRepair(cleanContent);
      }

      const parsed = JSON.parse(cleanContent);
      console.log('✅ Parsed JSON:', JSON.stringify(parsed, null, 2));

      // Validate the new JSON format
      if (typeof parsed.score !== 'number') {
        logger.error('Invalid response format: score is required');
        throw new Error('Invalid response format: score is required');
      }

      if (!Array.isArray(parsed.mistakes)) {
        logger.error('Invalid response format: mistakes must be an array');
        throw new Error('Invalid response format: mistakes must be an array');
      }

      if (!Array.isArray(parsed.speakers)) {
        logger.error('Invalid response format: speakers must be an array');
        throw new Error('Invalid response format: speakers must be an array');
      }

      return {
        score: parsed.score,
        mistakes: parsed.mistakes,
        speakers: parsed.speakers,
        overallScore: parsed.score,
        categoryScores: {},
        recommendations: [],
        summary: `Analysis completed with score: ${parsed.score}/100`,
        confidence: finishReason === 'length' ? 0.7 : 0.9, // Lower confidence for truncated responses
        tokenUsage: {
          input: response.usage?.prompt_tokens || response.tokenEstimation?.actualInputTokens || 0,
          output: response.usage?.completion_tokens || response.tokenEstimation?.outputTokens || 0,
          cost: 0
        },
        processingTime: 0,
        modelUsed: '',
        analysisId: ''
      };
    } catch (error: any) {
      console.error('❌ OpenAI Parsing Error:', error);
      console.error('❌ Error Details:', {
        message: error.message,
        response: response,
        content: response?.choices?.[0]?.message?.content,
        finishReason: response?.choices?.[0]?.finish_reason
      });
      logger.error('Failed to parse OpenAI response', error);
      throw new Error(`Failed to parse OpenAI response: ${error.message}. Content: ${response?.choices?.[0]?.message?.content || 'No content'}`);
    }
  }

  private isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  private attemptJSONRepair(truncatedJSON: string): string {
    // Basic JSON repair for truncated responses
    let repaired = truncatedJSON.trim();
    
    // If it doesn't end with a closing brace, try to complete it
    if (!repaired.endsWith('}')) {
      // Close any open arrays
      const openArrays = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < openArrays; i++) {
        repaired += ']';
      }
      
      // Close any open objects
      const openObjects = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < openObjects; i++) {
        repaired += '}';
      }
    }
    
    // Remove trailing commas before closing brackets
    repaired = repaired.replace(/,(\s*[\}\]])/g, '$1');
    
    console.log('🔧 Attempted JSON repair result:', repaired);
    return repaired;
  }

  private validateResult(result: OpenAIEvaluationResult, confidenceThreshold: number): OpenAIEvaluationResult {
    if (result.confidence < confidenceThreshold) {
      logger.warn(`OpenAI evaluation confidence is low (${result.confidence}). Results may be inaccurate.`);
    }

    return result;
  }

  private async handleApiError(error: any, context: string): Promise<never> {
    logger.error(`OpenAI API error in ${context}`, error);
    
    if (error.message?.includes('401')) {
      throw new Error('OpenAI API key is invalid or not configured. Please check your settings.');
    }
    
    if (error.message?.includes('429')) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    }
    
    if (error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503')) {
      throw new Error('OpenAI service is temporarily unavailable. Please try again later.');
    }
    
    throw new Error(error.message || `OpenAI evaluation failed: ${context}`);
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
