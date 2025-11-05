-- Migration: Add UPDATE policy for organization_members table
-- This migration allows owners and admins to update member roles in their organization

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Owners and admins can update organization members" ON public.organization_members;

-- Policy: Owners and admins can update organization members in their organization
CREATE POLICY "Owners and admins can update organization members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Owners and admins can update organization members" ON public.organization_members IS 
  'Allows owners and admins to update organization member roles and other attributes in their organization';

