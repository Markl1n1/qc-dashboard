
import React, { useState, useEffect } from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Agent } from '../types/agent';
import { agentService } from '../services/agentService';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

interface AgentSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onCreateNew?: () => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ value, onChange, onCreateNew }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const agentsData = await agentService.getAgents();
      setAgents(agentsData);
      setFilteredAgents(agentsData);
    } catch (error: any) {
      toast.error('Failed to load agents');
      console.error('Failed to load agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    const filtered = agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredAgents(filtered);
  }, [searchQuery, agents]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="agent-selector">Agent</Label>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-8"
                  />
                </div>
              </div>
              {isLoading ? (
                <SelectItem value="loading-placeholder" disabled>Loading agents...</SelectItem>
              ) : filteredAgents.length === 0 ? (
                <SelectItem value="no-agents-placeholder" disabled>
                  {searchQuery ? 'No agents found' : 'No agents available'}
                </SelectItem>
              ) : (
                filteredAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.name}>
                    {agent.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {onCreateNew && (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onCreateNew}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        )}
      </div>
    </div>
  );
};

export default AgentSelector;
