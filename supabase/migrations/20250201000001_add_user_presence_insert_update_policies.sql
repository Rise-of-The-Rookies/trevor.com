-- Add INSERT and UPDATE policies for user_presence table
-- Users can only insert/update their own presence data

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;

-- Policy: Users can insert their own presence record
CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own presence record
CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: SELECT policy already exists ("presence: read org peers")
-- This allows users to read their own presence and presence of organization members

