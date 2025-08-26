
-- Create agents table
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Add Row Level Security (RLS) to ensure users can only manage their own agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to SELECT their own agents
CREATE POLICY "Users can view their own agents" 
  ON public.agents 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to INSERT their own agents
CREATE POLICY "Users can create their own agents" 
  ON public.agents 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to UPDATE their own agents
CREATE POLICY "Users can update their own agents" 
  ON public.agents 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy that allows users to DELETE their own agents
CREATE POLICY "Users can delete their own agents" 
  ON public.agents 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at 
  BEFORE UPDATE ON public.agents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
