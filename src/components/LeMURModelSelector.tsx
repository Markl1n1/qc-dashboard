// Placeholder LeMUR model selector component
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LemurModel } from '../types/lemurEvaluation';

interface LeMURModelSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export type AssemblyAIRegion = 'us' | 'eu' | 'asia';

export const ASSEMBLYAI_REGIONS: AssemblyAIRegion[] = ['us', 'eu', 'asia'];

const LeMURModelSelector: React.FC<LeMURModelSelectorProps> = ({
  value,
  onValueChange,
  disabled = false
}) => {
  const models: LemurModel[] = [
    { id: 'lemur-v3', name: 'LeMUR v3', description: 'Latest model version' },
    { id: 'lemur-v2', name: 'LeMUR v2', description: 'Stable model version' }
  ];

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select LeMUR model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div>
              <div className="font-medium">{model.name}</div>
              {model.description && (
                <div className="text-sm text-muted-foreground">{model.description}</div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LeMURModelSelector;