-- Phase 2: Admin Dialog Access Policies
-- Create admin policies for dialogs table to allow admins to see all dialogs
CREATE POLICY "Admins can view all dialogs" 
ON public.dialogs 
FOR SELECT 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update all dialogs" 
ON public.dialogs 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete all dialogs" 
ON public.dialogs 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Create admin policies for dialog_transcriptions
CREATE POLICY "Admins can view all dialog transcriptions" 
ON public.dialog_transcriptions 
FOR SELECT 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update all dialog transcriptions" 
ON public.dialog_transcriptions 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete all dialog transcriptions" 
ON public.dialog_transcriptions 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Create admin policies for dialog_speaker_utterances
CREATE POLICY "Admins can view all dialog speaker utterances" 
ON public.dialog_speaker_utterances 
FOR SELECT 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update all dialog speaker utterances" 
ON public.dialog_speaker_utterances 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete all dialog speaker utterances" 
ON public.dialog_speaker_utterances 
FOR DELETE 
USING (get_current_user_role() = 'admin');

-- Create admin policies for dialog_analysis
CREATE POLICY "Admins can view all dialog analysis" 
ON public.dialog_analysis 
FOR SELECT 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update all dialog analysis" 
ON public.dialog_analysis 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete all dialog analysis" 
ON public.dialog_analysis 
FOR DELETE 
USING (get_current_user_role() = 'admin');