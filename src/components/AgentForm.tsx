
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';
import { toast } from 'sonner';

interface AgentFormProps {
  agent?: Agent;
  onSave: (data: CreateAgentRequest | UpdateAgentRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const AgentForm: React.FC<AgentFormProps> = ({ agent, onSave, onCancel, isLoading }) => {
  const [name, setName] = useState(agent?.name || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    try {
      await onSave({ name: name.trim() });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save agent');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{agent ? 'Edit Agent' : 'Create New Agent'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="agent-name">Agent Name</Label>
            <Input
              id="agent-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter agent name"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AgentForm;
