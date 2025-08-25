import { supabase } from '../integrations/supabase/client';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress } from '../types/openaiEvaluation';
import { SpeakerUtterance } from '../types';
import { useSettingsStore } from '../store/settingsStore';

class OpenAIEvaluationService {
  private progressCallback?: (progress: OpenAIEvaluationProgress) => void;

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: OpenAIEvaluationProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
  }

  async evaluateDialog(utterances: SpeakerUtterance[]): Promise<OpenAIEvaluationResult> {
    this.updateProgress('preparing', 10, 'Preparing evaluation...');

    try {
      // Get max tokens from settings
      const maxTokens = useSettingsStore.getState().openaiMaxTokens;
      
      const conversationText = utterances.map(u => `${u.speaker}: ${u.text}`).join('\n');
      
      const systemPrompt = `You are an expert customer service quality evaluator. Analyze the following customer service conversation and provide a comprehensive evaluation.

Evaluate the conversation based on these criteria:
1. Professionalism and courtesy
2. Problem-solving effectiveness
3. Communication clarity
4. Adherence to best practices
5. Customer satisfaction potential

For each issue you identify, provide:
- Category (professionalism, problem-solving, communication, compliance, satisfaction)
- Severity level (minor, major, critical)
- Specific description of the issue
- Exact text where the issue occurs
- Constructive suggestion for improvement
- Your confidence level (0-100)

Provide an overall score (0-100) and detailed recommendations.

Return your response in JSON format with this structure:
{
  "overallScore": 85,
  "mistakes": [
    {
      "category": "communication",
      "level": "minor",
      "description": "Could have been more empathetic",
      "text": "exact text from conversation",
      "suggestion": "Consider saying 'I understand your frustration...'",
      "confidence": 90
    }
  ],
  "recommendations": ["Specific actionable advice"],
  "summary": "Overall assessment of the conversation",
  "confidence": 92
}`;

      this.updateProgress('evaluating', 50, 'Running evaluation...');

      const { data, error } = await supabase.functions.invoke('openai-evaluate', {
        body: {
          systemPrompt,
          userPrompt: conversationText,
          maxTokens,
          model: 'gpt-4o-mini' // Start with the smaller model
        }
      });

      if (error) throw error;

      this.updateProgress('processing', 80, 'Processing results...');

      // Check if we need to retry with a better model due to low confidence
      let finalResult = data;
      if (data.confidence && data.confidence < 0.8) {
        this.updateProgress('evaluating', 60, 'Retrying with advanced model for better accuracy...');
        
        const { data: retryData, error: retryError } = await supabase.functions.invoke('openai-evaluate', {
          body: {
            systemPrompt,
            userPrompt: conversationText,
            maxTokens,
            model: 'gpt-4o' // Use the better model for retry
          }
        });

        if (!retryError && retryData.confidence > data.confidence) {
          finalResult = retryData;
        }
      }

      this.updateProgress('complete', 100, 'Evaluation completed');

      return finalResult;
    } catch (error) {
      this.updateProgress('error', 0, `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
