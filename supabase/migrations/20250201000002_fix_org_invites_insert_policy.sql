-- Fix org_invites INSERT policy to ensure it works correctly
-- This allows owners, admins, and supervisors to create invites for their organization

-- Drop the existing policy
DROP POLICY IF EXISTS "org_invites_insert_hierarchy" ON public.org_invites;

-- Create a new, clearer INSERT policy
-- This allows owners, admins, and supervisors to create invites for their organization
CREATE POLICY "org_invites_insert_hierarchy"
ON public.org_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM organization_members m
    WHERE m.organization_id = org_invites.organization_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'supervisor')
  )
);

-- Note: The policy ensures that:
-- 1. The user is authenticated
-- 2. The user is a member of the organization
-- 3. The user has one of the required roles (owner, admin, or supervisor)
-- 4. The organization_id in the insert matches the user's organization membership

