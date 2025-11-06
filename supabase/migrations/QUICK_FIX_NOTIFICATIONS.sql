-- ========================================
-- QUICK FIX: Extension Request Notifications
-- ========================================
-- Copy and paste this entire file into Supabase SQL Editor and run it
-- This will enable notifications for extension requests

-- Step 1: Create function to get admins/owners
CREATE OR REPLACE FUNCTION get_task_organization_admins(task_uuid UUID)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT om.user_id
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  JOIN organization_members om ON p.organization_id = om.organization_id
  WHERE t.id = task_uuid
    AND om.role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create function to notify when extension is requested
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

-- Step 3: Create function to notify when extension is decided
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

-- Step 4: Drop old triggers if they exist
DROP TRIGGER IF EXISTS extension_request_created_trigger ON extension_requests;
DROP TRIGGER IF EXISTS extension_request_decided_trigger ON extension_requests;

-- Step 5: Create new triggers
CREATE TRIGGER extension_request_created_trigger
  AFTER INSERT ON extension_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_extension_request_created();

CREATE TRIGGER extension_request_decided_trigger
  AFTER UPDATE ON extension_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_extension_request_decided();

-- Step 6: Verify installation
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'extension_requests'
ORDER BY trigger_name;

-- ========================================
-- If you see 2 triggers listed above, it worked! ✅
-- ========================================

