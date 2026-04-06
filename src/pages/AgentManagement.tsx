
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import AgentForm from '../components/AgentForm';
import AgentList from '../components/AgentList';
import AgentCsvImport from '../components/AgentCsvImport';
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';
import { agentService } from '../services/agentService';
import { useAuthStore } from '../store/authStore';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../i18n';

const AgentManagement: React.FC = () => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();

  const loadAgents = async () => {
    try { setIsLoading(true); const agentsData = await agentService.getAgents(); setAgents(agentsData); setFilteredAgents(agentsData); }
    catch (error: any) { toast.error(t('agents.deleteFailed')); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (user) loadAgents(); }, [user]);
  useEffect(() => { setFilteredAgents(agents.filter(agent => agent.name.toLowerCase().includes(searchQuery.toLowerCase()))); }, [searchQuery, agents]);

  const handleCreateAgent = async (data: CreateAgentRequest) => {
    try { setIsLoading(true); await agentService.createAgent(data); toast.success(t('agents.agentCreated')); setShowForm(false); await loadAgents(); }
    catch (error: any) { if (error.message?.includes('duplicate key')) toast.error(t('agents.duplicateAgent')); else toast.error(t('agents.createFailed')); throw error; }
    finally { setIsLoading(false); }
  };

  const handleBulkCreateAgents = async (agentNames: string[]) => {
    const errors: string[] = [];
    for (const name of agentNames) {
      try { await agentService.createAgent({ name }); } catch (error: any) { errors.push(error.message); }
    }
    if (errors.length > 0 && errors.length === agentNames.length) throw new Error(errors.join(', '));
  };

  const handleUpdateAgent = async (data: UpdateAgentRequest) => {
    if (!editingAgent) return;
    try { setIsLoading(true); await agentService.updateAgent(editingAgent.id, data); toast.success(t('agents.agentUpdated')); setEditingAgent(null); await loadAgents(); }
    catch (error: any) { if (error.message?.includes('duplicate key')) toast.error(t('agents.duplicateAgent')); else toast.error(t('agents.updateFailed')); throw error; }
    finally { setIsLoading(false); }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm(t('agents.confirmDelete'))) return;
    try { setIsLoading(true); await agentService.deleteAgent(id); toast.success(t('agents.agentDeleted')); await loadAgents(); }
    catch (error: any) { toast.error(t('agents.deleteFailed')); } finally { setIsLoading(false); }
  };

  if (!user) {
    return <div className="container mx-auto p-6"><Card><CardContent className="p-6"><p className="text-center text-muted-foreground">{t('agents.pleaseLogin')}</p></CardContent></Card></div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('agents.title')}</h1>
        {!showForm && (
          <div className="flex gap-2">
            <AgentCsvImport onImportComplete={loadAgents} onBulkCreate={handleBulkCreateAgents} />
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />{t('agents.addAgent')}</Button>
          </div>
        )}
      </div>
      {showForm ? (
        <AgentForm agent={editingAgent || undefined} onSave={editingAgent ? handleUpdateAgent : handleCreateAgent} onCancel={() => { setShowForm(false); setEditingAgent(null); }} isLoading={isLoading} />
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>{t('agents.searchAgents')}</CardTitle></CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('agents.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
            </CardContent>
          </Card>
          <AgentList agents={filteredAgents} onEdit={(agent) => { setEditingAgent(agent); setShowForm(true); }} onDelete={handleDeleteAgent} isLoading={isLoading} />
        </>
      )}
    </div>
  );
};

export default AgentManagement;
