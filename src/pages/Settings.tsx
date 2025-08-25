
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useSettingsStore } from '../store/settingsStore';

const Settings: React.FC = () => {
  const { openaiMaxTokens, setOpenaiMaxTokens } = useSettingsStore();
  const [localMaxTokens, setLocalMaxTokens] = useState(openaiMaxTokens);

  const handleSave = () => {
    if (localMaxTokens < 1 || localMaxTokens > 10000) {
      toast.error('Max tokens must be between 1 and 10,000');
      return;
    }
    
    setOpenaiMaxTokens(localMaxTokens);
    toast.success('Settings saved successfully');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your VoiceQC application settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>OpenAI Configuration</CardTitle>
            <CardDescription>
              Configure OpenAI API settings for evaluations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Maximum Output Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={localMaxTokens}
                onChange={(e) => setLocalMaxTokens(Number(e.target.value))}
                min={1}
                max={10000}
                placeholder="Enter maximum tokens (1-10000)"
              />
              <p className="text-sm text-muted-foreground">
                Controls the maximum number of tokens in OpenAI responses. Higher values allow for longer responses but cost more.
              </p>
            </div>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
