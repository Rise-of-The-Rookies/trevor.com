-- ========================================
-- FIX: Extension Request Notification Type Error
-- ========================================
-- This script fixes the type casting error in the notification trigger
-- Copy and paste this entire file into Supabase SQL Editor and run it
--
-- Error: column "type" is of type notification_type but expression is of type text
-- ========================================

-- Fix the notify_extension_request_decided function
CREATE OR REPLACE FUNCTION notify_extension_request_decided()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  decider_name TEXT;
BEGIN
  -- Only proceed if status changed to approved or rejected
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    -- Get task title
    SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
    
    -- Get decider name
    SELECT full_name INTO decider_name FROM users WHERE id = NEW.decided_by;
    
    -- Create notification for the requester
    -- FIX: Cast the CASE expression result to notification_type enum
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.requester_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'extension_approved'::notification_type
        ELSE 'extension_rejected'::notification_type
      END,
      jsonb_build_object(
        'extension_request_id', NEW.id,
        'task_id', NEW.task_id,
        'task_title', task_title,
        'decided_by', NEW.decided_by,
        'decider_name', decider_name,
        'decision_note', NEW.decision_note,
        'status', NEW.status,
        'message', 
          CASE 
            WHEN NEW.status = 'approved' 
            THEN 'Your extension request for "' || task_title || '" has been approved'
            ELSE 'Your extension request for "' || task_title || '" has been rejected'
          END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix notify_extension_request_created function for consistency
CREATE OR REPLACE FUNCTION notify_extension_request_created()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_id UUID;
  task_title TEXT;
  requester_name TEXT;
BEGIN
  -- Get task title
  SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
  
  -- Get requester name
  SELECT full_name INTO requester_name FROM users WHERE id = NEW.requester_id;
  
  -- Create notifications for all admins and owners
  FOR admin_user_id IN 
    SELECT user_id FROM get_task_organization_admins(NEW.task_id)
  LOOP
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      admin_user_id,
      'extension_requested'::notification_type,
      jsonb_build_object(
        'extension_request_id', NEW.id,
        'task_id', NEW.task_id,
        'task_title', task_title,
        'requester_id', NEW.requester_id,
        'requester_name', requester_name,
        'requested_due_at', NEW.requested_due_at,
        'reason', NEW.reason,
        'message', requester_name || ' requested an extension for "' || task_title || '"'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the functions were updated
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname IN ('notify_extension_request_decided', 'notify_extension_request_created')
ORDER BY proname;

-- ========================================
-- If you see the functions listed above, the fix worked! ✅
-- ========================================


