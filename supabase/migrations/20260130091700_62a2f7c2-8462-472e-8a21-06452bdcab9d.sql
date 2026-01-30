-- Удалить старые политики SELECT
DROP POLICY IF EXISTS "Authenticated users can view agents" ON public.agents;
DROP POLICY IF EXISTS "Users can view their own agents" ON public.agents;
DROP POLICY IF EXISTS "Admins can view all agents" ON public.agents;

-- Создать новые политики SELECT
-- 1. Supervisors видят только свои агенты
CREATE POLICY "Users can view their own agents"
  ON public.agents FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Admins видят всех агентов
CREATE POLICY "Admins can view all agents"
  ON public.agents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));