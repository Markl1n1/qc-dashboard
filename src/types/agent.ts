
export interface Agent {
  id: string;
  user_id: string;
  name: string; // This serves as both name and stage (e.g., "sales", "support", etc.)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentRequest {
  name: string; // Agent stage/name
}

export interface UpdateAgentRequest {
  name?: string;
  is_active?: boolean;
}
