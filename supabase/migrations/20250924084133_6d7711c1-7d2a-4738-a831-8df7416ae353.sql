-- Update data retention to 14 days
UPDATE system_config SET value = '14' WHERE key = 'data_retention_days';

-- Run the function to update all existing dialog expiration dates
SELECT update_dialog_expiration_dates();