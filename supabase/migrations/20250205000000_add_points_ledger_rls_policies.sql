-- Migration: Add RLS policies for points_ledger, redemptions, and rewards tables
-- This migration allows users to view and insert their own points when completing tasks,
-- redeem rewards, and view available rewards

-- ============================================================================
-- POINTS_LEDGER POLICIES
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own points" ON public.points_ledger;
DROP POLICY IF EXISTS "Users can insert points for task completion" ON public.points_ledger;
DROP POLICY IF EXISTS "Owners and admins can view organization points" ON public.points_ledger;

-- Policy: Users can view their own points
CREATE POLICY "Users can view their own points"
ON public.points_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert points when completing tasks
-- This allows users to insert points only for themselves when completing tasks
CREATE POLICY "Users can insert points for task completion"
ON public.points_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be inserting points for themselves
  auth.uid() = user_id
  AND (
    -- Allow task completion points (positive delta)
    (reason_code = 'task_completion' AND task_id IS NOT NULL AND delta > 0)
    OR
    -- Allow assignment completion points (positive delta)
    (reason_code = 'assignment_completion' AND task_id IS NOT NULL AND delta > 0)
    OR
    -- Allow reward redemption (negative delta for spending)
    (reason_code = 'reward_redemption' AND delta < 0)
  )
);

-- Policy: Owners and admins can view all points in their organization
CREATE POLICY "Owners and admins can view organization points"
ON public.points_ledger
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = points_ledger.user_id
      AND u.id IN (
        SELECT user_id FROM organization_members
        WHERE organization_id = om.organization_id
      )
    )
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Users can view their own points" ON public.points_ledger IS 
  'Allows users to view their own points transactions';

COMMENT ON POLICY "Users can insert points for task completion" ON public.points_ledger IS 
  'Allows users to insert points for themselves when completing tasks or assignments';

COMMENT ON POLICY "Owners and admins can view organization points" ON public.points_ledger IS 
  'Allows owners and admins to view points for all users in their organization';

-- ============================================================================
-- REDEMPTIONS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Users can insert their own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Owners and admins can view organization redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Owners and admins can update organization redemptions" ON public.redemptions;

-- Policy: Users can view their own redemptions
CREATE POLICY "Users can view their own redemptions"
ON public.redemptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own redemptions
CREATE POLICY "Users can insert their own redemptions"
ON public.redemptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM rewards r
    WHERE r.id = redemptions.reward_id
    AND r.active = true
    AND (r.stock IS NULL OR r.stock > 0)
  )
);

-- Policy: Owners and admins can view all redemptions in their organization
CREATE POLICY "Owners and admins can view organization redemptions"
ON public.redemptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role IN ('owner', 'admin')
    AND om2.user_id = redemptions.user_id
  )
);

-- Policy: Owners and admins can update redemptions in their organization
CREATE POLICY "Owners and admins can update organization redemptions"
ON public.redemptions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role IN ('owner', 'admin')
    AND om2.user_id = redemptions.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om1.role IN ('owner', 'admin')
    AND om2.user_id = redemptions.user_id
  )
);

-- ============================================================================
-- REWARDS POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view active rewards in their organization" ON public.rewards;
DROP POLICY IF EXISTS "Owners and admins can manage rewards" ON public.rewards;

-- Policy: Users can view active rewards in their organization
CREATE POLICY "Users can view active rewards in their organization"
ON public.rewards
FOR SELECT
TO authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = rewards.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Policy: Owners and admins can manage (insert, update, delete) rewards in their organization
CREATE POLICY "Owners and admins can manage rewards"
ON public.rewards
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = rewards.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = rewards.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Policy: Users can update stock when redeeming
-- Note: Application logic should ensure stock only decreases, not increases
CREATE POLICY "Users can update reward stock on redemption"
ON public.rewards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = rewards.organization_id
    AND om.user_id = auth.uid()
  )
  AND rewards.active = true
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = rewards.organization_id
    AND om.user_id = auth.uid()
  )
  AND rewards.active = true
);

-- Add comments for documentation
COMMENT ON POLICY "Users can view their own redemptions" ON public.redemptions IS 
  'Allows users to view their own redemption history';

COMMENT ON POLICY "Users can insert their own redemptions" ON public.redemptions IS 
  'Allows users to create redemption requests for themselves';

COMMENT ON POLICY "Users can view active rewards in their organization" ON public.rewards IS 
  'Allows users to view active rewards available in their organization';

COMMENT ON POLICY "Owners and admins can manage rewards" ON public.rewards IS 
  'Allows owners and admins to create, update, and delete rewards in their organization';

