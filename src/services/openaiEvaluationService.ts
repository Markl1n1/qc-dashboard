
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

    return `${instructions}

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
  }

  private async callOpenAIEdgeFunction(prompt: string, model: string): Promise<any> {
    try {
      // Determine if this is a GPT-5 or newer model that requires different parameters
      const isGPT5OrNewer = model.includes('gpt-5') || model.includes('gpt-4.1') || model.includes('o3') || model.includes('o4');
      
      const requestBody: any = {
        model: model,
        messages: [{ role: "user", content: prompt }],
      };

      // For GPT-5 and newer models, use max_completion_tokens and reasoning_effort
      if (isGPT5OrNewer) {
        requestBody.max_output_tokens = 1000;
        if (model.includes('o3') || model.includes('o4')) {
          requestBody.reasoning_effort = 'medium';
        }
        // Note: temperature is not supported for GPT-5 and newer models
      } else {
        // For legacy models (gpt-4o family), use max_tokens and temperature
        requestBody.max_output_tokens = 1000;
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

      return data;
    } catch (error: any) {
      logger.error('Error calling OpenAI edge function', error);
      throw error;
    }
  }

  private parseOpenAIResponse(response: any): OpenAIEvaluationResult {
    try {
      console.log('🔍 OpenAI Raw Response:', JSON.stringify(response, null, 2));
      
      if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
        logger.error('Invalid OpenAI response structure');
        throw new Error('Invalid OpenAI response structure');
      }

      const content = response.choices[0].message.content;
      console.log('📝 OpenAI Content:', content);
      
      if (!content) {
        logger.error('No content in OpenAI response');
        throw new Error('No content in OpenAI response');
      }

      // Try to clean content if it has markdown formatting
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🧹 Cleaned Content:', cleanContent);

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
        confidence: 0.9,
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
        content: response?.choices?.[0]?.message?.content
      });
      logger.error('Failed to parse OpenAI response', error);
      throw new Error(`Failed to parse OpenAI response: ${error.message}. Content: ${response?.choices?.[0]?.message?.content || 'No content'}`);
    }
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
