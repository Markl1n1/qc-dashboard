-- Add composite indexes for performance optimization

-- Index for dialog queries by user and status
CREATE INDEX IF NOT EXISTS idx_dialogs_user_status ON dialogs(user_id, status);

-- Index for dialog queries by user and upload date
CREATE INDEX IF NOT EXISTS idx_dialogs_user_upload_date ON dialogs(user_id, upload_date DESC);

-- Index for dialog analysis queries
CREATE INDEX IF NOT EXISTS idx_dialog_analysis_dialog_created ON dialog_analysis(dialog_id, created_at DESC);

-- Index for dialog transcriptions queries  
CREATE INDEX IF NOT EXISTS idx_dialog_transcriptions_dialog_type ON dialog_transcriptions(dialog_id, transcription_type);

-- Index for speaker utterances queries
CREATE INDEX IF NOT EXISTS idx_dialog_speaker_utterances_transcription_order ON dialog_speaker_utterances(transcription_id, utterance_order);

-- Index for deepgram usage log queries
CREATE INDEX IF NOT EXISTS idx_deepgram_usage_log_created_success ON deepgram_usage_log(created_at DESC, success);

-- Index for system config key lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Index for agents by user and active status
CREATE INDEX IF NOT EXISTS idx_agents_user_active ON agents(user_id, is_active);