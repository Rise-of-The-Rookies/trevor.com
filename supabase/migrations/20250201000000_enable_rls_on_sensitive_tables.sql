-- Migration: Enable Row Level Security (RLS) on all sensitive tables
-- This ensures that users can only access data they're authorized to see
-- Date: 2025-02-01

-- ============================================================================
-- USER AND AUTHENTICATION RELATED TABLES
-- ============================================================================

-- Users table - contains user profile information
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Profiles table - additional user profile data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Organization members - critical for access control
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- User presence - real-time presence data
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATION RELATED TABLES
-- ============================================================================

-- Organizations - contains organization data
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Organization invites - invitation codes and access
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROJECT AND TASK RELATED TABLES
-- ============================================================================

-- Projects - contains project information
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members - project-level access control
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Phases - project phases
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;

-- Tasks - core task data
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Task collaborators - task collaboration data
ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

-- Time logs - time tracking data
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TASK INTERACTION TABLES
-- ============================================================================

-- Comments - user comments on tasks
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Attachments - file attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Extension requests - task extension requests
ALTER TABLE public.extension_requests ENABLE ROW LEVEL SECURITY;

-- Transfer requests - task transfer requests
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POINTS AND REWARDS SYSTEM
-- ============================================================================

-- Points ledger - points/currency transactions
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- Rewards - rewards catalog
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Redemptions - reward redemptions
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMUNICATION AND EVENTS
-- ============================================================================

-- Announcements - organization announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Events - event log/audit trail
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ATTENDANCE SYSTEM
-- ============================================================================

-- Attendance checkins - attendance tracking
ALTER TABLE public.attendance_checkins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this query to verify RLS is enabled on all tables:
-- SELECT 
--     schemaname,
--     tablename,
--     rowsecurity as rls_enabled
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- ⚠️ WARNING: After enabling RLS, you MUST create appropriate policies for each table
-- RLS enabled without policies will block ALL access by default
-- 
-- Example policy structure:
-- CREATE POLICY "policy_name" ON table_name
--   FOR SELECT|INSERT|UPDATE|DELETE
--   TO authenticated
--   USING (condition);
--
-- See existing migrations for examples:
-- - supabase/migrations/20250130000001_add_notifications_rls_policies.sql
-- - supabase/migrations/20250126000002_create_teams_system.sql
--
-- Next step: Create RLS policies for each table based on your access control requirements
