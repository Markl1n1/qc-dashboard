
-- Create call quality analysis table
CREATE TABLE public.call_quality_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dialog_id uuid NOT NULL REFERENCES public.dialogs(id) ON DELETE CASCADE,
  overall_score integer NOT NULL DEFAULT 0,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(dialog_id)
);

-- Enable RLS
ALTER TABLE public.call_quality_analysis ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view call quality of their dialogs"
ON public.call_quality_analysis FOR SELECT
USING (EXISTS (
  SELECT 1 FROM dialogs WHERE dialogs.id = call_quality_analysis.dialog_id AND dialogs.user_id = auth.uid()
));

CREATE POLICY "Users can create call quality for their dialogs"
ON public.call_quality_analysis FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM dialogs WHERE dialogs.id = call_quality_analysis.dialog_id AND dialogs.user_id = auth.uid()
));

CREATE POLICY "Users can update call quality of their dialogs"
ON public.call_quality_analysis FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM dialogs WHERE dialogs.id = call_quality_analysis.dialog_id AND dialogs.user_id = auth.uid()
));

CREATE POLICY "Users can delete call quality of their dialogs"
ON public.call_quality_analysis FOR DELETE
USING (EXISTS (
  SELECT 1 FROM dialogs WHERE dialogs.id = call_quality_analysis.dialog_id AND dialogs.user_id = auth.uid()
));

CREATE POLICY "Admins can view all call quality"
ON public.call_quality_analysis FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all call quality"
ON public.call_quality_analysis FOR ALL
USING (get_current_user_role() = 'admin');

-- Trigger for updated_at
CREATE TRIGGER update_call_quality_analysis_updated_at
BEFORE UPDATE ON public.call_quality_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_call_quality_dialog_id ON public.call_quality_analysis(dialog_id);
