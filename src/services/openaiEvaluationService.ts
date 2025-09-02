
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

      progressCallback({ stage: 'processing_response', message: 'Saving analysis results', progress: 0.9 });

      // Save the analysis to database
      await this.saveAnalysis(dialogId, parsedResult, validatedResult.confidence, evaluation.tokenEstimation);

      progressCallback({ stage: 'complete', message: 'Validation complete', progress: 0.9 });

      logger.info(`OpenAI evaluation completed for dialog ${dialogId}`);
      progressCallback({ stage: 'complete', message: 'Evaluation complete', progress: 1 });

      return validatedResult;
    } catch (error: any) {
      await this.handleApiError(error, 'evaluate');
      throw error;
    }
  }

  private async saveAnalysis(
    dialogId: string,
    result: any,
    confidence: number,
    tokenUsage?: any
  ): Promise<void> {
    try {
      console.log('💾 Saving analysis to database...', { dialogId, confidence, tokenUsage });
      console.log('📊 Analysis result structure:', result);
      
      // Extract speaker information from both the raw result and parsed format
      let speakerData = null;
      if (result.speakers) {
        if (Array.isArray(result.speakers) && result.speakers.length > 0) {
          speakerData = result.speakers[0];
        } else if (typeof result.speakers === 'object') {
          speakerData = result.speakers;
        }
        console.log('👥 Extracted speaker data:', speakerData);
      }

      // Save individual mistakes as separate rows with structured data
      if (result.mistakes && Array.isArray(result.mistakes) && result.mistakes.length > 0) {
        console.log(`📝 Saving ${result.mistakes.length} mistakes individually...`);
        
        for (const mistake of result.mistakes) {
          const analysisData = {
            dialog_id: dialogId,
            analysis_type: 'openai',
            overall_score: result.score,
            mistakes: [mistake], // Keep the original format for backward compatibility
            category_scores: {},
            confidence: confidence,
            token_usage: tokenUsage || {},
            summary: '',
            recommendations: [],
            // New structured columns
            comment: mistake.comment || '',
            utterance: mistake.utterance || '',
            rule_category: mistake.rule_category || '',
            speaker_0: speakerData?.speaker_0 || '',
            role_0: speakerData?.role_0 || '',
            speaker_1: speakerData?.speaker_1 || '',
            role_1: speakerData?.role_1 || ''
          };

          console.log('💾 Saving individual mistake:', analysisData);
          
          const { data, error } = await supabase
            .from('dialog_analysis')
            .insert(analysisData)
            .select()
            .single();
          
          if (error) {
            console.error('❌ Failed to save individual mistake:', error, analysisData);
            throw new Error(`Failed to save analysis: ${error.message}`);
          }

          console.log('✅ Individual mistake saved successfully:', data);
        }
      } else {
        // Fallback: save a single row with overall score even if no mistakes
        console.log('📝 No mistakes found, saving summary analysis...');
        
        const analysisData = {
          dialog_id: dialogId,
          analysis_type: 'openai',
          overall_score: result.score,
          mistakes: [],
          category_scores: {},
          confidence: confidence,
          token_usage: tokenUsage || {},
           summary: '',
          recommendations: [],
          // New structured columns
          comment: '',
          utterance: '',
          rule_category: '',
          speaker_0: speakerData?.speaker_0 || '',
          role_0: speakerData?.role_0 || '',
          speaker_1: speakerData?.speaker_1 || '',
          role_1: speakerData?.role_1 || ''
        };

        const { data, error } = await supabase
          .from('dialog_analysis')
          .insert(analysisData)
          .select()
          .single();
        
        if (error) {
          console.error('❌ Failed to save summary analysis:', error);
          throw new Error(`Failed to save analysis: ${error.message}`);
        }

        console.log('✅ Summary analysis saved successfully:', data);
      }

      // Update speaker names in utterances if speakers data is available
      if (speakerData) {
        await this.updateSpeakerNames(dialogId, [speakerData]);
        console.log('✅ Speaker names updated successfully');
      }
    } catch (error) {
      console.error('❌ Error saving analysis:', error);
      throw error;
    }
  }

  private async updateSpeakerNames(dialogId: string, speakersData: any[]): Promise<void> {
    try {
      // Get the dialog's transcription and utterances
      const { data: transcriptions, error: transcriptionsError } = await supabase
        .from('dialog_transcriptions')
        .select('id')
        .eq('dialog_id', dialogId);

      if (transcriptionsError || !transcriptions || transcriptions.length === 0) {
        console.log('No transcriptions found for dialog:', dialogId);
        return;
      }

      for (const transcription of transcriptions) {
        const { data: utterances, error: utterancesError } = await supabase
          .from('dialog_speaker_utterances')
          .select('*')
          .eq('transcription_id', transcription.id);

        if (utterancesError || !utterances) {
          console.log('No utterances found for transcription:', transcription.id);
          continue;
        }

        // Update speaker names
        const speakerMapping = speakersData[0] || {};
        const updates = utterances.map(utterance => {
          let newSpeaker = utterance.speaker;
          
          if (utterance.speaker === 'Speaker 0' && speakerMapping.speaker_0) {
            newSpeaker = speakerMapping.speaker_0;
          } else if (utterance.speaker === 'Speaker 1' && speakerMapping.speaker_1) {
            newSpeaker = speakerMapping.speaker_1;
          }

          return {
            id: utterance.id,
            speaker: newSpeaker
          };
        });

        // Batch update the utterances
        for (const update of updates) {
          if (update.speaker !== utterances.find(u => u.id === update.id)?.speaker) {
            await supabase
              .from('dialog_speaker_utterances')
              .update({ speaker: update.speaker })
              .eq('id', update.id);
          }
        }
      }
    } catch (error) {
      console.error('Error updating speaker names:', error);
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

      // Enhanced JSON cleaning with improved quote escaping
      let cleanContent = this.cleanAndRepairJSON(content);
      console.log('🧹 Cleaned Content:', cleanContent);

      // Multiple parsing strategies for fallback
      let parsed: any;
      try {
        parsed = JSON.parse(cleanContent);
      } catch (firstError) {
        console.log('🔧 First parse failed, attempting advanced repair...');
        cleanContent = this.advancedJSONRepair(cleanContent);
        try {
          parsed = JSON.parse(cleanContent);
          console.log('✅ Advanced repair successful');
        } catch (secondError) {
          console.log('🔧 Advanced repair failed, attempting partial recovery...');
          parsed = this.attemptPartialRecovery(content);
          if (!parsed) {
            throw new Error(`JSON parsing failed after all repair attempts. Original error: ${firstError.message}. Content: ${content.slice(0, 200)}...`);
          }
        }
      }

      console.log('✅ Parsed JSON:', JSON.stringify(parsed, null, 2));

      // Validate and provide defaults for required fields
      const score = typeof parsed.score === 'number' ? parsed.score : 0;
      const mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes : [];
      
      // Handle GPT-5 speaker format: array containing flat object with speaker_0, role_0, etc.
      let speakers = [];
      if (Array.isArray(parsed.speakers) && parsed.speakers.length > 0) {
        const speakerData = parsed.speakers[0];
        console.log('Processing speaker data:', speakerData);
        
        // Transform flat format to structured format
        if (typeof speakerData === 'object' && 
            (speakerData.speaker_0 !== undefined || speakerData.speaker_1 !== undefined)) {
          
          if (speakerData.speaker_0 !== undefined) {
            speakers.push({
              name: speakerData.speaker_0,
              role: speakerData.role_0 || 'Unknown'
            });
          }
          
          if (speakerData.speaker_1 !== undefined) {
            speakers.push({
              name: speakerData.speaker_1,
              role: speakerData.role_1 || 'Unknown'
            });
          }
          
          console.log('Transformed speakers:', speakers);
        } else {
          // Already in structured format
          speakers = parsed.speakers;
        }
      } else if (parsed.speakers && typeof parsed.speakers === 'object' && !Array.isArray(parsed.speakers)) {
        // Direct flat object format
        const speakerData = parsed.speakers;
        if (speakerData.speaker_0 !== undefined) {
          speakers.push({
            name: speakerData.speaker_0,
            role: speakerData.role_0 || 'Unknown'
          });
        }
        if (speakerData.speaker_1 !== undefined) {
          speakers.push({
            name: speakerData.speaker_1,
            role: speakerData.role_1 || 'Unknown'
          });
        }
      }

      // Enhanced validation with detailed error messages
      if (mistakes.length === 0 && score === 0) {
        console.warn('⚠️ No mistakes found and score is 0 - this might indicate parsing issues');
      }

      return {
        score: score,
        mistakes: mistakes,
        speakers: speakers,
        overallScore: score,
        categoryScores: {},
        recommendations: [],
        summary: `Analysis completed with score: ${score}/100${speakers.length > 0 ? `, speakers identified: ${speakers.length}` : ''}`,
        confidence: finishReason === 'length' ? 0.7 : 0.9,
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
        content: response?.choices?.[0]?.message?.content?.slice(0, 500),
        finishReason: response?.choices?.[0]?.finish_reason
      });
      logger.error('Failed to parse OpenAI response', error);
      throw new Error(`Failed to parse OpenAI response: ${error.message}. Content preview: ${response?.choices?.[0]?.message?.content?.slice(0, 200) || 'No content'}...`);
    }
  }

  private cleanAndRepairJSON(content: string): string {
    let cleanContent = content.trim();
    
    // Remove markdown formatting
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // First: Handle triple-escaped quotes from GPT-5 responses
    cleanContent = cleanContent.replace(/\\\\\"/g, '\\"');
    
    // Enhanced quote escaping for contractions and embedded quotes
    // Handle common contractions that appear in utterances with various escaping levels
    const contractionPatterns = [
      { pattern: /(\s|^|["\\\"])don't(\s|$|["\\\"])/gi, replacement: "$1don\\'t$2" },
      { pattern: /(\s|^|["\\\"])can't(\s|$|["\\\"])/gi, replacement: "$1can\\'t$2" },
      { pattern: /(\s|^|["\\\"])won't(\s|$|["\\\"])/gi, replacement: "$1won\\'t$2" },
      { pattern: /(\s|^|["\\\"])it's(\s|$|["\\\"])/gi, replacement: "$1it\\'s$2" },
      { pattern: /(\s|^|["\\\"])we're(\s|$|["\\\"])/gi, replacement: "$1we\\'re$2" },
      { pattern: /(\s|^|["\\\"])they're(\s|$|["\\\"])/gi, replacement: "$1they\\'re$2" },
      { pattern: /(\s|^|["\\\"])you're(\s|$|["\\\"])/gi, replacement: "$1you\\'re$2" },
      { pattern: /(\s|^|["\\\"])there's(\s|$|["\\\"])/gi, replacement: "$1there\\'s$2" },
      { pattern: /(\s|^|["\\\"])that's(\s|$|["\\\"])/gi, replacement: "$1that\\'s$2" },
      { pattern: /(\s|^|["\\\"])what's(\s|$|["\\\"])/gi, replacement: "$1what\\'s$2" },
      { pattern: /(\s|^|["\\\"])I'm(\s|$|["\\\"])/gi, replacement: "$1I\\'m$2" },
      { pattern: /(\s|^|["\\\"])doesn't(\s|$|["\\\"])/gi, replacement: "$1doesn\\'t$2" }
    ];
    
    for (const { pattern, replacement } of contractionPatterns) {
      cleanContent = cleanContent.replace(pattern, replacement);
    }
    
    // Progressive quote escaping - handle multiple levels of escaping
    // Fix utterance and comment fields specifically
    cleanContent = cleanContent.replace(
      /"(utterance|comment)"\s*:\s*\\?"([^"]*(?:\\.[^"]*)*)\\?"/g,
      (match, key, value) => {
        // Clean up the value and properly escape quotes
        let escapedValue = value.replace(/\\+"/g, '\\"').replace(/(?<!\\)"/g, '\\"');
        return `"${key}": "${escapedValue}"`;
      }
    );
    
    // Context-aware quote escaping for general JSON string values
    cleanContent = cleanContent.replace(
      /"([^"]+)"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g,
      (match, key, value) => {
        // Don't escape quotes in property names, only in values
        if (key.includes('\\')) return match; // Skip already processed keys
        const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
        return `"${key}": "${escapedValue}"`;
      }
    );
    
    return cleanContent;
  }

  private advancedJSONRepair(content: string): string {
    let repaired = content.trim();
    
    // More aggressive quote fixing
    repaired = repaired
      .replace(/([^\\])"([^":\[\],{}]*)"([^:])/g, '$1\\"$2\\"$3')
      .replace(/([^\\])'([^':\[\],{}]*)'([^:])/g, '$1"$2"$3') // Replace single quotes with double quotes
      .replace(/([^\\])"([^"]*don)'t/g, '$1"$2\\\t') // Fix contractions like "don't"
      .replace(/([^\\])"([^"]*can)'t/g, '$1"$2\\\t')
      .replace(/([^\\])"([^"]*won)'t/g, '$1"$2\\\t');
    
    // Ensure proper array and object closure
    if (!this.isValidJSON(repaired)) {
      repaired = this.attemptJSONRepair(repaired);
    }
    
    return repaired;
  }

  private attemptPartialRecovery(content: string): any | null {
    try {
      // Try to extract basic structure even from malformed JSON
      const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
      const mistakesMatch = content.match(/"mistakes"\s*:\s*\[([^\]]*)\]/s);
      
      // Handle both flat object and array formats for speakers
      const speakersObjectMatch = content.match(/"speakers"\s*:\s*\{([^}]*)\}/s);
      const speakersArrayMatch = content.match(/"speakers"\s*:\s*\[([^\]]*)\]/s);
      
      if (scoreMatch) {
        const mistakes = mistakesMatch ? this.extractMistakesFromText(mistakesMatch[1]) : [];
        
        let speakers = [];
        if (speakersObjectMatch) {
          // New flat object format
          try {
            const speakersObj = JSON.parse(`{${speakersObjectMatch[1]}}`);
            speakers = [speakersObj];
          } catch (error) {
            console.warn('Failed to parse speakers object in partial recovery');
          }
        } else if (speakersArrayMatch) {
          // Old array format
          speakers = this.extractSpeakersFromText(speakersArrayMatch[1]);
        }
        
        return {
          score: parseInt(scoreMatch[1], 10),
          mistakes: mistakes,
          speakers: speakers
        };
      }
    } catch (error) {
      console.error('Partial recovery failed:', error);
    }
    
    return null;
  }

  private extractMistakesFromText(mistakesText: string): any[] {
    try {
      // Try to parse individual mistake objects
      const mistakes = [];
      const mistakeMatches = mistakesText.match(/\{[^}]+\}/g);
      
      if (mistakeMatches) {
        for (const match of mistakeMatches) {
          try {
            const cleanMatch = this.cleanAndRepairJSON(match);
            const mistake = JSON.parse(cleanMatch);
            mistakes.push(mistake);
          } catch (error) {
            console.warn('Failed to parse individual mistake:', match);
          }
        }
      }
      
      return mistakes;
    } catch (error) {
      return [];
    }
  }

  private extractSpeakersFromText(speakersText: string): any[] {
    try {
      // Handle GPT-5 array format: [ { "speaker_0": "Name", "role_0": "Agent", ... } ]
      const arrayMatch = speakersText.match(/\[\s*\{([^}]+)\}\s*\]/);
      if (arrayMatch) {
        try {
          const speakerObj = JSON.parse(`{${arrayMatch[1]}}`);
          
          // Transform flat format to structured format
          const transformedSpeakers = [];
          if (speakerObj.speaker_0 !== undefined) {
            transformedSpeakers.push({
              name: speakerObj.speaker_0,
              role: speakerObj.role_0 || 'Unknown'
            });
          }
          if (speakerObj.speaker_1 !== undefined) {
            transformedSpeakers.push({
              name: speakerObj.speaker_1,
              role: speakerObj.role_1 || 'Unknown'
            });
          }
          
          return transformedSpeakers;
        } catch (error) {
          console.warn('Failed to parse GPT-5 speaker array format');
        }
      }
      
      // Try to extract flat speaker object format
      const flatSpeakerMatch = speakersText.match(/\{([^}]+)\}/);
      if (flatSpeakerMatch) {
        try {
          const speakersObj = JSON.parse(`{${flatSpeakerMatch[1]}}`);
          
          // Check if it's the flat format
          if (speakersObj.speaker_0 !== undefined || speakersObj.speaker_1 !== undefined) {
            const transformedSpeakers = [];
            if (speakersObj.speaker_0 !== undefined) {
              transformedSpeakers.push({
                name: speakersObj.speaker_0,
                role: speakersObj.role_0 || 'Unknown'
              });
            }
            if (speakersObj.speaker_1 !== undefined) {
              transformedSpeakers.push({
                name: speakersObj.speaker_1,
                role: speakersObj.role_1 || 'Unknown'
              });
            }
            return transformedSpeakers;
          }
          
          return [speakersObj];
        } catch (error) {
          console.warn('Failed to parse flat speaker format');
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error in extractSpeakersFromText:', error);
      return [];
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
