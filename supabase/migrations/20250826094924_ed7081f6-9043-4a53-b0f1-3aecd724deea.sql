
-- Add theme preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark'));

-- Update the existing RLS policies to include the new column
-- (The existing policies will automatically cover the new column)
