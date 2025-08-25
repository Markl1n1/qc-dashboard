
import { EvaluationConfiguration } from '../types/lemurEvaluation';
import { lemurEvaluationService } from '../services/lemurEvaluationService';

export const generateCustomEvaluationPromptTemplate = (configuration: EvaluationConfiguration): string => {
  return lemurEvaluationService.getCustomEvaluationPromptTemplate(configuration);
};

export const previewCustomPrompt = (configuration: EvaluationConfiguration, sampleConversation?: string): string => {
  const template = generateCustomEvaluationPromptTemplate(configuration);
  
  let preview = template;
  
  if (sampleConversation) {
    preview = preview.replace(
      '[The full conversation will be inserted here during actual evaluation]',
      sampleConversation
    );
  }
  
  return preview;
};
