
export interface Agent {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string;
}

export interface UpdateAgentRequest {
  name?: string;
  is_active?: boolean;
}
