
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Eye, EyeOff, Key } from 'lucide-react';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  description?: string;
  isValid?: boolean;
}

const ApiKeyInput = ({ 
  value, 
  onChange, 
  placeholder = "Enter your AssemblyAI API key",
  label = "AssemblyAI API Key",
  description = "Enter your AssemblyAI API key to enable cloud transcription",
  isValid = true
}: ApiKeyInputProps) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="api-key">API Key</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={!isValid && value ? "border-red-500" : ""}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {!isValid && value && (
            <p className="text-sm text-red-500 mt-1">
              Invalid API key format
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Your API key is stored locally and never sent to our servers
          </p>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Don't have an API key? <a href="https://assemblyai.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get one from AssemblyAI</a></p>
          <p>Free tier includes 3 hours of transcription per month</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiKeyInput;
