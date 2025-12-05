-- Migration: Make npc_id nullable in group_members table
-- This allows both users and NPCs to be members of groups

ALTER TABLE public.group_members 
ALTER COLUMN npc_id DROP NOT NULL;

-- Add a check constraint to ensure either npc_id or member_id is set based on member_type
-- For 'ai' or 'npc' type: npc_id should be set
-- For 'user' type: member_id should be set (npc_id can be null)

-- Note: The existing member_id and member_type columns handle this logic
-- This migration simply removes the NOT NULL constraint on npc_id
