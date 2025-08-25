
import { SpeakerUtterance } from '../types';
import { OpenAIEvaluationResult, OpenAIEvaluationProgress } from '../types/openaiEvaluation';

class OpenAIEvaluationService {
  private progressCallback: ((progress: OpenAIEvaluationProgress) => void) | null = null;

  setProgressCallback(callback: (progress: OpenAIEvaluationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(progress: number, message: string, stage: OpenAIEvaluationProgress['stage']) {
    if (this.progressCallback) {
      this.progressCallback({
        progress,
        message,
        stage
      });
    }
  }

  async evaluateConversation(utterances: SpeakerUtterance[], model: string): Promise<OpenAIEvaluationResult> {
    this.updateProgress(0, 'Initializing evaluation...', 'initializing');

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateProgress(25, 'Preparing conversation data...', 'initializing');
      
      // Prepare conversation text
      const conversationText = utterances
        .map(u => `${u.speaker}: ${u.text}`)
        .join('\n');

      this.updateProgress(50, 'Analyzing conversation...', 'analyzing');

      // Simulate analysis
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.updateProgress(75, 'Processing AI response...', 'processing_response');

      // Mock evaluation result
      const result: OpenAIEvaluationResult = {
        id: `eval_${Date.now()}`,
        overallScore: Math.floor(Math.random() * 40) + 60, // 60-100
        confidence: Math.floor(Math.random() * 20) + 80, // 80-100
        summary: 'The conversation shows good engagement and professionalism.',
        recommendations: [
          'Consider more active listening techniques',
          'Improve closing strategies'
        ],
        mistakes: [],
        categoryScores: {
          communication: Math.floor(Math.random() * 30) + 70,
          professionalism: Math.floor(Math.random() * 30) + 70,
          problem_solving: Math.floor(Math.random() * 30) + 70
        },
        modelUsed: model,
        processingTime: Date.now() - performance.now(),
        tokenUsage: {
          input: conversationText.length / 4, // Rough estimate
          output: 150,
          cost: 0.002
        }
      };

      this.updateProgress(100, 'Evaluation complete', 'complete');

      return result;
    } catch (error) {
      this.updateProgress(0, 'Evaluation failed', 'error');
      throw error;
    }
  }
}

export const openaiEvaluationService = new OpenAIEvaluationService();
