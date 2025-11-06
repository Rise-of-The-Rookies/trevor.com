-- ========================================
-- TASK ASSIGNMENT NOTIFICATIONS FIX
-- ========================================
-- This script enables notifications when employees/supervisors are assigned to tasks
-- Copy and paste this entire file into Supabase SQL Editor and run it

-- ========================================
-- STEP 1: Add enum values to notification_type
-- ========================================

-- Add 'task_assigned' if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'task_assigned' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'task_assigned';
  END IF;
END $$;

-- Add 'task_due_reminder' if it doesn't exist (for future use)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'task_due_reminder' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'task_due_reminder';
  END IF;
END $$;

-- Verify enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
AND enumlabel LIKE '%task%'
ORDER BY enumlabel;

-- ========================================
-- STEP 2: Create notification function
-- ========================================

-- Function to notify user when assigned to a task
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  assigner_name TEXT;
  task_due_date TEXT;
  task_priority TEXT;
  task_type_val TEXT;
BEGIN
  -- Only notify if assignee_id changed (new assignment or reassignment)
  IF (TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id AND NEW.assignee_id IS NOT NULL) THEN
    
    -- Get task details
    SELECT title, due_date, priority, task_type 
    INTO task_title, task_due_date, task_priority, task_type_val
    FROM tasks WHERE id = NEW.id;
    
    -- Get assigner name (created_by for new tasks)
    IF NEW.created_by IS NOT NULL THEN
      SELECT full_name INTO assigner_name FROM users WHERE id = NEW.created_by;
    END IF;
    
    -- If no assigner name found, use generic
    IF assigner_name IS NULL THEN
      assigner_name := 'System';
    END IF;
    
    -- Create notification for the assignee
    INSERT INTO notifications (user_id, type, payload)
    VALUES (
      NEW.assignee_id,
      'task_assigned',
      jsonb_build_object(
        'task_id', NEW.id,
        'task_title', task_title,
        'task_type', COALESCE(task_type_val, 'task'),
        'priority', task_priority,
        'due_date', task_due_date,
        'assigned_by', NEW.created_by,
        'assigner_name', assigner_name,
        'message', 
          CASE 
            WHEN TG_OP = 'INSERT' THEN 
              'You have been assigned to "' || task_title || '"'
            ELSE 
              'You have been reassigned to "' || task_title || '"'
          END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 3: Create trigger
-- ========================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS task_assigned_trigger ON tasks;

-- Create trigger for task assignment
CREATE TRIGGER task_assigned_trigger
  AFTER INSERT OR UPDATE OF assignee_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

-- ========================================
-- STEP 4: Create index for performance
-- ========================================

-- Create an index for faster due date queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_assignee 
ON tasks(due_date, assignee_id) 
WHERE status NOT IN ('done', 'submitted') AND due_date IS NOT NULL;

-- ========================================
-- STEP 5: Verify installation
-- ========================================

-- Check trigger
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'task_assigned_trigger'
ORDER BY trigger_name;

-- Check function
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name = 'notify_task_assigned';

-- ========================================
-- ✅ SUCCESS INDICATORS:
-- ========================================
-- 1. First query should show enum values:
--    - task_assigned
--    - task_due_reminder (and possibly others)
--
-- 2. Second-to-last query should show 1 trigger:
--    - task_assigned_trigger (INSERT, UPDATE, AFTER)
--
-- 3. Last query should show 1 function:
--    - notify_task_assigned (FUNCTION)
-- ========================================

-- ========================================
-- TESTING
-- ========================================
-- After running this script:
-- 1. Create a new task and assign it to an employee/supervisor
-- 2. Run this query to check if notification was created:
--
-- SELECT 
--   id,
--   user_id,
--   type,
--   payload->>'message' as message,
--   payload->>'task_title' as task_title,
--   payload->>'assigner_name' as assigner_name,
--   created_at,
--   read_at
-- FROM notifications 
-- WHERE type = 'task_assigned'
-- ORDER BY created_at DESC 
-- LIMIT 5;
-- ========================================

