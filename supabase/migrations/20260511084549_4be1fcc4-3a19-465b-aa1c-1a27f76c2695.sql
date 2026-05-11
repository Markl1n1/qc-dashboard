UPDATE public.dialogs
SET status='failed',
    error_message='Transcription never started (client disconnected before invoking edge function)',
    updated_at=now()
WHERE id='ebe4eef2-4bc6-4d4d-9e44-1c4cefd9b1b1';