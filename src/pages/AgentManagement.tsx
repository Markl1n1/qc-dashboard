
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import AgentForm from '../components/AgentForm';
import AgentList from '../components/AgentList';
import AgentCsvImport from '../components/AgentCsvImport';
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

const AgentManagement: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuthStore();

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
    if (user) {
      loadAgents();
    }
  }, [user]);

  useEffect(() => {
    const filtered = agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredAgents(filtered);
  }, [searchQuery, agents]);

  const handleCreateAgent = async (data: CreateAgentRequest) => {
    try {
      setIsLoading(true);
      await agentService.createAgent(data);
      toast.success('Agent created successfully');
      setShowForm(false);
      await loadAgents();
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        toast.error('An agent with this name already exists');
      } else {
        toast.error('Failed to create agent');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkCreateAgents = async (agentNames: string[]) => {
    const errors: string[] = [];
    
    for (const name of agentNames) {
      try {
        await agentService.createAgent({ name });
      } catch (error: any) {
        if (error.message?.includes('duplicate key')) {
          errors.push(`Agent "${name}" already exists`);
        } else {
          errors.push(`Failed to create agent "${name}": ${error.message}`);
        }
      }
    }
    
    if (errors.length > 0 && errors.length === agentNames.length) {
      throw new Error(errors.join(', '));
    }
    
    if (errors.length > 0) {
      console.warn('Some agents failed to create:', errors);
    }
  };

  const handleUpdateAgent = async (data: UpdateAgentRequest) => {
    if (!editingAgent) return;
    
    try {
      setIsLoading(true);
      await agentService.updateAgent(editingAgent.id, data);
      toast.success('Agent updated successfully');
      setEditingAgent(null);
      await loadAgents();
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        toast.error('An agent with this name already exists');
      } else {
        toast.error('Failed to update agent');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      setIsLoading(true);
      await agentService.deleteAgent(id);
      toast.success('Agent deleted successfully');
      await loadAgents();
    } catch (error: any) {
      toast.error('Failed to delete agent');
      console.error('Failed to delete agent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAgent(null);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Please log in to manage agents.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agent Management</h1>
        {!showForm && (
          <div className="flex gap-2">
            <AgentCsvImport 
              onImportComplete={loadAgents}
              onBulkCreate={handleBulkCreateAgents}
            />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>
        )}
      </div>

      {showForm ? (
        <AgentForm
          agent={editingAgent || undefined}
          onSave={editingAgent ? handleUpdateAgent : handleCreateAgent}
          onCancel={handleCancelForm}
          isLoading={isLoading}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Search Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          <AgentList
            agents={filteredAgents}
            onEdit={handleEdit}
            onDelete={handleDeleteAgent}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
};

export default AgentManagement;
