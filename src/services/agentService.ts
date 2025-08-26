
import { supabase } from '../integrations/supabase/client';
import { Agent, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';
import { logger } from './loggingService';

class AgentService {
  async getAgents(): Promise<Agent[]> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch agents', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Agent service: getAgents failed', error as Error);
      throw error;
    }
  }

  async createAgent(agentData: CreateAgentRequest): Promise<Agent> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('agents')
        .insert([{
          user_id: user.user.id,
          name: agentData.name.trim()
        }])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create agent', error, { agentData });
        throw error;
      }

      logger.info('Agent created successfully', { agentId: data.id });
      return data as Agent;
    } catch (error) {
      logger.error('Agent service: createAgent failed', error as Error, { agentData });
      throw error;
    }
  }

  async updateAgent(id: string, updates: UpdateAgentRequest): Promise<Agent> {
    try {
      const { data, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update agent', error, { agentId: id, updates });
        throw error;
      }

      logger.info('Agent updated successfully', { agentId: id });
      return data as Agent;
    } catch (error) {
      logger.error('Agent service: updateAgent failed', error as Error, { agentId: id, updates });
      throw error;
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete agent', error, { agentId: id });
        throw error;
      }

      logger.info('Agent deleted successfully', { agentId: id });
    } catch (error) {
      logger.error('Agent service: deleteAgent failed', error as Error, { agentId: id });
      throw error;
    }
  }
}

export const agentService = new AgentService();
