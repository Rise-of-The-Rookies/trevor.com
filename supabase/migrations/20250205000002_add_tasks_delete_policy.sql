-- Migration: Add DELETE policy for tasks table
-- This migration allows owners, admins, and supervisors to delete tasks in their organization

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Owners admins supervisors can delete tasks" ON public.tasks;

-- Policy: Owners, admins, and supervisors can delete tasks in their organization
CREATE POLICY "Owners admins supervisors can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = tasks.project_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'supervisor')
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Owners admins supervisors can delete tasks" ON public.tasks IS 
  'Allows owners, admins, and supervisors to delete tasks in their organization';

