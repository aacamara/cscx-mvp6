-- Migration: Add document and spreadsheet action types to approval queue
-- This extends the approval system to support Google Docs/Sheets creation

-- Drop the existing constraint
ALTER TABLE approval_queue DROP CONSTRAINT IF EXISTS approval_queue_action_type_check;

-- Add new constraint with additional action types
ALTER TABLE approval_queue ADD CONSTRAINT approval_queue_action_type_check
  CHECK (action_type IN (
    'send_email',
    'schedule_meeting',
    'create_task',
    'share_document',
    'create_document',
    'create_spreadsheet',
    'other'
  ));
