-- Migration: Add RLS policies for extension_requests table
-- This migration allows users to create, view, and update their own extension requests
-- and allows owners/admins to view and manage all extension requests in their organization

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Drop existing SELECT policies if they exist
DROP POLICY IF EXISTS "Users can view their own extension requests" ON public.extension_requests;
DROP POLICY IF EXISTS "Owners and admins can view organization extension requests" ON public.extension_requests;

-- Policy: Users can view their own extension requests
CREATE POLICY "Users can view their own extension requests"
ON public.extension_requests
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
);

-- Policy: Owners and admins can view all extension requests in their organization
CREATE POLICY "Owners and admins can view organization extension requests"
ON public.extension_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE t.id = extension_requests.task_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Drop existing INSERT policies if they exist
DROP POLICY IF EXISTS "Users can insert their own extension requests" ON public.extension_requests;

-- Policy: Users can insert extension requests for tasks assigned to them
CREATE POLICY "Users can insert their own extension requests"
ON public.extension_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = extension_requests.task_id
    AND t.assignee_id = auth.uid()
  )
);

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Drop existing UPDATE policies if they exist
DROP POLICY IF EXISTS "Users can update their own pending extension requests" ON public.extension_requests;
DROP POLICY IF EXISTS "Owners and admins can update organization extension requests" ON public.extension_requests;

-- Policy: Users can update their own pending extension requests (before decision)
CREATE POLICY "Users can update their own pending extension requests"
ON public.extension_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'pending'
);

-- Policy: Owners and admins can update extension requests in their organization (for approval/rejection)
CREATE POLICY "Owners and admins can update organization extension requests"
ON public.extension_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE t.id = extension_requests.task_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE t.id = extension_requests.task_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Add comments for documentation
COMMENT ON POLICY "Users can view their own extension requests" ON public.extension_requests IS 
  'Allows authenticated users to view their own extension requests';

COMMENT ON POLICY "Owners and admins can view organization extension requests" ON public.extension_requests IS 
  'Allows owners and admins to view all extension requests in their organization';

COMMENT ON POLICY "Users can insert their own extension requests" ON public.extension_requests IS 
  'Allows users to create extension requests for tasks assigned to them';

COMMENT ON POLICY "Users can update their own pending extension requests" ON public.extension_requests IS 
  'Allows users to update their own pending extension requests before they are approved/rejected';

COMMENT ON POLICY "Owners and admins can update organization extension requests" ON public.extension_requests IS 
  'Allows owners and admins to approve or reject extension requests in their organization';

