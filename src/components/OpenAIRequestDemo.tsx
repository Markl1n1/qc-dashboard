
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Code, Play, Settings } from 'lucide-react';
import { useEnhancedSettingsStore } from '../store/enhancedSettingsStore';
import { formatDialogForAIAnalysis } from '../utils/dialogFormatting';
import { OPENAI_MODELS } from '../types/openaiEvaluation';
import { toast } from 'sonner';

const OpenAIRequestDemo: React.FC = () => {
  const { systemConfig, loadSystemConfig } = useEnhancedSettingsStore();
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    loadSystemConfig();
  }, [loadSystemConfig]);

  // Sample dialog for demo purposes
  const sampleUtterances = [
    {
      speaker: 'Speaker 0',
      text: 'Hello, thank you for calling customer service. How can I help you today?',
      start: 0,
      end: 3.5,
      confidence: 0.95
    },
    {
      speaker: 'Speaker 1', 
      text: 'Hi, I have an issue with my recent order. It was supposed to arrive yesterday but I haven\'t received it yet.',
      start: 4,
      end: 8.2,
      confidence: 0.92
    },
    {
      speaker: 'Speaker 0',
      text: 'I understand your concern. Let me look up your order information. Can you please provide me with your order number?',
      start: 8.5,
      end: 14.1,
      confidence: 0.94
    },
    {
      speaker: 'Speaker 1',
      text: 'Sure, it\'s order number 12345678.',
      start: 14.5,
      end: 16.8,
      confidence: 0.89
    }
  ];

  const getCurrentSettings = () => {
    const confidence = systemConfig?.ai_confidence_threshold || '0.8';
    const maxTokensGpt5Mini = systemConfig?.ai_max_tokens_gpt5_mini || '1000';
    const maxTokensGpt5 = systemConfig?.ai_max_tokens_gpt5 || '2000';
    const temperature = systemConfig?.ai_temperature || '0.7';
    const reasoningEffort = systemConfig?.ai_reasoning_effort || 'medium';

    return {
      confidenceThreshold: parseFloat(confidence),
      maxTokensGpt5Mini: parseInt(maxTokensGpt5Mini),
      maxTokensGpt5: parseInt(maxTokensGpt5),
      temperature: parseFloat(temperature),
      reasoningEffort
    };
  };

  const buildDemoRequest = () => {
    const settings = getCurrentSettings();
    const modelId = 'gpt-5-mini-2025-08-07';
    const model = OPENAI_MODELS.find(m => m.id === modelId);
    const conversationText = formatDialogForAIAnalysis(sampleUtterances);

    const systemPrompt = `You are an expert call center quality analyst. Analyze customer service conversations and provide detailed evaluation.

EVALUATION CRITERIA:
- Communication: Clarity, tone, active listening, empathy
- Professionalism: Courtesy, appropriate language, patience
- Problem Solving: Understanding issues, providing solutions, follow-up
- Compliance: Following procedures, data protection, policies
- Customer Satisfaction: Meeting needs, resolving concerns

RESPONSE FORMAT:
Respond with valid JSON only in this exact structure:
{
  "overallScore": number (0-100),
  "categoryScores": {
    "communication": number (0-100),
    "professionalism": number (0-100),
    "problem_solving": number (0-100),
    "compliance": number (0-100),
    "customer_satisfaction": number (0-100)
  },
  "mistakes": [...],
  "recommendations": [...],
  "summary": "Overall summary...",
  "confidence": number (0-100)
}`;

    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': 'Bearer YOUR_OPENAI_API_KEY',
        'Content-Type': 'application/json'
      },
      body: {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please evaluate this customer service conversation (timestamps in [MM:SS] format):\n\n${conversationText}`
          }
        ],
        max_completion_tokens: settings.maxTokensGpt5Mini,
        reasoning_effort: settings.reasoningEffort
        // Note: temperature is not included for GPT-5 models as it's not supported
      },
      settings: {
        confidenceThreshold: settings.confidenceThreshold,
        hybridEvaluation: 'Will retry with GPT-5 flagship if confidence < ' + (settings.confidenceThreshold * 100) + '%'
      }
    };
  };

  const demoRequest = buildDemoRequest();

  const handleCopyRequest = async () => {
    const requestJson = JSON.stringify(demoRequest, null, 2);
    try {
      await navigator.clipboard.writeText(requestJson);
      toast.success('Request JSON copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy request');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            OpenAI Request Demo
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowRequest(!showRequest)}
            >
              {showRequest ? 'Hide' : 'Show'} Request
            </Button>
            {showRequest && (
              <Button variant="outline" size="sm" onClick={handleCopyRequest}>
                Copy JSON
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Configuration */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Current AI Configuration
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Confidence Threshold:</span>
              <Badge variant="outline" className="ml-2">
                {(getCurrentSettings().confidenceThreshold * 100).toFixed(0)}%
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Max Tokens (Mini):</span>
              <Badge variant="outline" className="ml-2">
                {getCurrentSettings().maxTokensGpt5Mini}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Max Tokens (GPT-5):</span>
              <Badge variant="outline" className="ml-2">
                {getCurrentSettings().maxTokensGpt5}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Temperature:</span>
              <Badge variant="outline" className="ml-2">
                {getCurrentSettings().temperature} (Legacy only)
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Reasoning Effort:</span>
              <Badge variant="outline" className="ml-2">
                {getCurrentSettings().reasoningEffort}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Primary Model:</span>
              <Badge variant="secondary" className="ml-2">
                GPT-5 Mini
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Sample Conversation */}
        <div>
          <h4 className="font-medium mb-3">Sample Conversation (Demo Data)</h4>
          <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
            {sampleUtterances.map((utterance, index) => (
              <div key={index} className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {Math.floor(utterance.start / 60)}:{(utterance.start % 60).toFixed(0).padStart(2, '0')}
                </Badge>
                <span className="font-medium">{utterance.speaker}:</span>
                <span>{utterance.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details */}
        {showRequest && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium mb-3">Generated OpenAI Request</h4>
              <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto text-sm">
                <pre>{JSON.stringify(demoRequest, null, 2)}</pre>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                <p><strong>Note:</strong> This shows exactly how your current configuration will be used to build OpenAI requests.</p>
                <p><strong>Hybrid Evaluation:</strong> If confidence is below {(getCurrentSettings().confidenceThreshold * 100).toFixed(0)}%, the system will automatically retry with GPT-5 flagship model.</p>
                <p><strong>Temperature:</strong> Not included for GPT-5 models as they don't support this parameter.</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenAIRequestDemo;
