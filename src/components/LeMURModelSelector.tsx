
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Badge } from './ui/badge';

export interface LeMURModel {
  id: string;
  name: string;
  description: string;
  sdkParameter: string;
  lemurApiName: string; // Actual LeMUR API model name
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  regions: ('US' | 'EU')[];
  note?: string; // Additional info about model availability
}

const LEMUR_MODELS: LeMURModel[] = [
  {
    id: 'claude_sonnet_4_20250514',
    name: 'Claude 4 Sonnet',
    description: 'Latest model with enhanced reasoning. Currently maps to Claude 3.5 Sonnet in LeMUR API.',
    sdkParameter: 'anthropic/claude-sonnet-4-20250514',
    lemurApiName: 'claude-3-5-sonnet',
    badge: 'Recommended',
    badgeVariant: 'default',
    regions: ['US', 'EU'],
    note: 'Uses Claude 3.5 Sonnet until Claude 4 is available in LeMUR'
  },
  {
    id: 'claude_opus_4_20250514',
    name: 'Claude 4 Opus',
    description: 'Most capable model. Currently maps to Claude 3 Opus in LeMUR API.',
    sdkParameter: 'anthropic/claude-opus-4-20250514',
    lemurApiName: 'claude-3-opus',
    badge: 'Most Capable',
    badgeVariant: 'secondary',
    regions: ['US'],
    note: 'Uses Claude 3 Opus until Claude 4 is available in LeMUR'
  },
  {
    id: 'claude3_7_sonnet_20250219',
    name: 'Claude 3.7 Sonnet',
    description: 'Advanced model with enhanced reasoning capabilities.',
    sdkParameter: 'anthropic/claude-3-7-sonnet-20250219',
    lemurApiName: 'claude-3-5-sonnet',
    regions: ['US', 'EU']
  },
  {
    id: 'claude3_5_sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Balanced performance model. Direct LeMUR API support.',
    sdkParameter: 'anthropic/claude-3-5-sonnet',
    lemurApiName: 'claude-3-5-sonnet',
    badge: 'Direct Support',
    badgeVariant: 'outline',
    regions: ['US', 'EU']
  },
  {
    id: 'claude3_5_haiku_20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and efficient model for quick analysis.',
    sdkParameter: 'anthropic/claude-3-5-haiku-20241022',
    lemurApiName: 'claude-3-haiku',
    badge: 'US Default',
    badgeVariant: 'outline',
    regions: ['US']
  },
  {
    id: 'claude3_opus',
    name: 'Claude 3.0 Opus',
    description: 'Most powerful Claude 3 model with direct LeMUR support.',
    sdkParameter: 'anthropic/claude-3-opus',
    lemurApiName: 'claude-3-opus',
    badge: 'Direct Support',
    badgeVariant: 'outline',
    regions: ['US']
  },
  {
    id: 'claude3_haiku',
    name: 'Claude 3.0 Haiku',
    description: 'Entry-level model with direct LeMUR support.',
    sdkParameter: 'anthropic/claude-3-haiku',
    lemurApiName: 'claude-3-haiku',
    badge: 'EU Default',
    badgeVariant: 'outline',
    regions: ['US', 'EU']
  }
];

export type AssemblyAIRegion = 'US' | 'EU';

export const ASSEMBLYAI_REGIONS = {
  US: {
    name: 'United States',
    apiUrl: 'https://api.assemblyai.com',
    defaultModel: 'claude3_5_haiku_20241022'
  },
  EU: {
    name: 'European Union',
    apiUrl: 'https://api.eu.assemblyai.com',
    defaultModel: 'claude3_haiku'
  }
} as const;

interface LeMURModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  selectedRegion: AssemblyAIRegion;
  onRegionChange: (region: AssemblyAIRegion) => void;
  disabled?: boolean;
}

const LeMURModelSelector: React.FC<LeMURModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  selectedRegion,
  onRegionChange,
  disabled = false
}) => {
  const availableModels = LEMUR_MODELS.filter(model => model.regions.includes(selectedRegion));
  const selectedModelData = availableModels.find(m => m.id === selectedModel);

  // Auto-select default model when region changes
  React.useEffect(() => {
    const defaultModel = ASSEMBLYAI_REGIONS[selectedRegion].defaultModel;
    const isSelectedModelAvailable = availableModels.some(m => m.id === selectedModel);
    
    if (!isSelectedModelAvailable) {
      onModelChange(defaultModel);
    }
  }, [selectedRegion, selectedModel, availableModels, onModelChange]);

  return (
    <div className="space-y-4">
      {/* Region Selection */}
      <div className="space-y-2">
        <Label htmlFor="assemblyai-region">AssemblyAI Region</Label>
        <Select value={selectedRegion} onValueChange={onRegionChange} disabled={disabled}>
          <SelectTrigger id="assemblyai-region">
            <SelectValue placeholder="Select region">
              {selectedRegion && (
                <div className="flex items-center gap-2">
                  <span>{ASSEMBLYAI_REGIONS[selectedRegion].name}</span>
                  <Badge variant="outline" className="text-xs">
                    {ASSEMBLYAI_REGIONS[selectedRegion].apiUrl}
                  </Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ASSEMBLYAI_REGIONS).map(([key, region]) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{region.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{region.apiUrl}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label htmlFor="lemur-model">LeMUR Model</Label>
        <Select value={selectedModel} onValueChange={onModelChange} disabled={disabled}>
          <SelectTrigger id="lemur-model">
            <SelectValue placeholder="Select a model">
              {selectedModelData && (
                <div className="flex items-center gap-2">
                  <span>{selectedModelData.name}</span>
                  {selectedModelData.badge && (
                    <Badge variant={selectedModelData.badgeVariant} className="text-xs">
                      {selectedModelData.badge}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    API: {selectedModelData.lemurApiName}
                  </Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {model.badge && (
                      <Badge variant={model.badgeVariant} className="text-xs">
                        {model.badge}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      API: {model.lemurApiName}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>{model.description}</div>
                    {model.note && (
                      <div className="text-xs text-orange-600 mt-1">ℹ️ {model.note}</div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Region Availability Info */}
      <div className="text-xs text-muted-foreground">
        Showing {availableModels.length} model(s) available in {ASSEMBLYAI_REGIONS[selectedRegion].name}
        <br />
        ℹ️ Models are mapped to available LeMUR API endpoints until newer models are supported
      </div>
    </div>
  );
};

export default LeMURModelSelector;
export { LEMUR_MODELS };
