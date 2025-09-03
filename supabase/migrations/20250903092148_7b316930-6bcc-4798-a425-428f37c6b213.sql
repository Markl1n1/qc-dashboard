-- Update agents RLS policies to allow all authenticated users to view
DROP POLICY IF EXISTS "Authenticated users can view agents" ON agents;
CREATE POLICY "Authenticated users can view agents" 
  ON agents FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Keep other agents policies unchanged for create/update/delete (user-specific)
-- Dialogs remain user-specific (no changes needed)
-- System_config access remains admin-only (no changes needed)