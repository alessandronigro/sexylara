-- Migration: Add allow_member_invite column to groups table
-- Date: 2025-12-10
-- Description: Adds missing allow_member_invite column that controls whether
--              regular members can invite others to the group

ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS allow_member_invite boolean DEFAULT false;

-- Set default to true for existing groups to maintain current behavior
UPDATE public.groups 
SET allow_member_invite = false 
WHERE allow_member_invite IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.groups.allow_member_invite IS 
'Controls whether regular members (non-owners/admins) can invite users and NPCs to the group';
