-- Migration: Add UPDATE and DELETE policies for organizations table
-- This migration allows owners to update and delete their organizations

-- ============================================================================
-- UPDATE POLICY
-- ============================================================================

-- Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;

-- Policy: Only owners can update organizations
CREATE POLICY "Owners can update their organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
);

-- ============================================================================
-- DELETE POLICY
-- ============================================================================

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Owners can delete their organizations" ON public.organizations;

-- Policy: Only owners can delete organizations
CREATE POLICY "Owners can delete their organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = organizations.id
    AND om.user_id = auth.uid()
    AND om.role = 'owner'
  )
);

-- Add comments for documentation
COMMENT ON POLICY "Owners can update their organizations" ON public.organizations IS 
  'Allows organization owners to update their organization settings';

COMMENT ON POLICY "Owners can delete their organizations" ON public.organizations IS 
  'Allows organization owners to delete their organizations';

