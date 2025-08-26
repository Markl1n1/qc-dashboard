
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Globe, Zap, Shield } from 'lucide-react';
import { AssemblyAIRegion } from '../types/assemblyai';
import { AssemblyAIRegionService } from '../services/assemblyaiRegionService';

interface AssemblyAIRegionSelectorProps {
  selectedRegion: AssemblyAIRegion;
  onRegionChange: (region: AssemblyAIRegion) => void;
  disabled?: boolean;
}

const AssemblyAIRegionSelector: React.FC<AssemblyAIRegionSelectorProps> = ({
  selectedRegion,
  onRegionChange,
  disabled = false
}) => {
  const regions = AssemblyAIRegionService.getAllRegions();

  const getRegionIcon = (region: AssemblyAIRegion) => {
    return region === 'eu' ? <Shield className="h-4 w-4" /> : <Zap className="h-4 w-4" />;
  };

  const getRegionBadge = (region: AssemblyAIRegion) => {
    return region === 'eu' ? 
      <Badge variant="secondary">GDPR Compliant</Badge> : 
      <Badge variant="default">Primary</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          AssemblyAI Region
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select 
            value={selectedRegion} 
            onValueChange={(value) => onRegionChange(value as AssemblyAIRegion)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region.region} value={region.region}>
                  <div className="flex items-center gap-2">
                    {getRegionIcon(region.region)}
                    <span>{region.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="space-y-2">
            {regions.map((region) => (
              <div 
                key={region.region}
                className={`p-3 rounded-lg border transition-colors ${
                  selectedRegion === region.region 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getRegionIcon(region.region)}
                    <span className="font-medium">{region.name}</span>
                  </div>
                  {getRegionBadge(region.region)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {region.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssemblyAIRegionSelector;
