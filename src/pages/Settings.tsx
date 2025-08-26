
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import ApiKeyInput from '../components/ApiKeyInput';
import { DeepgramKeyManager } from '../components/DeepgramKeyManager';
import { PromptContextManager } from '../components/PromptContextManager';
import { LanguageAwareRuleManager } from '../components/LanguageAwareRuleManager';
import AIInstructionsManager from '../components/AIInstructionsManager';
import PasscodeManager from '../components/PasscodeManager';
import { useUserRole } from '../hooks/useUserRole';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('api-keys');
  const { role } = useUserRole();
  const isAdmin = role === 'admin';

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your application settings and API keys.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="deepgram-keys">Deepgram Keys</TabsTrigger>
          <TabsTrigger value="ai-settings">AI Settings</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ApiKeyInput 
                value=""
                onChange={() => {}}
                serviceName="OpenAI" 
                keyName="openai_api_key"
                description="Required for AI-powered evaluations and analysis"
                placeholder="sk-..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deepgram-keys" className="space-y-6">
          {isAdmin ? (
            <DeepgramKeyManager />
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <p className="text-muted-foreground">
                  Admin access required to manage Deepgram API keys.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai-settings" className="space-y-6">
          <PromptContextManager />
          <LanguageAwareRuleManager />
          <AIInstructionsManager />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <PasscodeManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
