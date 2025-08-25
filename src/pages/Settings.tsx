
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import { useUserRole } from '../hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

const Settings = () => {
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const { maxTokens, setMaxTokens } = useSettingsStore();
  const [localMaxTokens, setLocalMaxTokens] = useState<number>(maxTokens);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLocalMaxTokens(maxTokens);
  }, [maxTokens]);

  const updateMaxTokens = async () => {
    setIsLoading(true);
    try {
      setMaxTokens(localMaxTokens);
      toast({
        title: "Success",
        description: "Max tokens setting updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-2 mb-6">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Admin Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>OpenAI Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="max-tokens">Max Output Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min="100"
                max="4000"
                value={localMaxTokens}
                onChange={(e) => setLocalMaxTokens(parseInt(e.target.value) || 1000)}
                placeholder="1000"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum number of tokens for OpenAI response (100-4000)
              </p>
            </div>
            <Button onClick={updateMaxTokens} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
