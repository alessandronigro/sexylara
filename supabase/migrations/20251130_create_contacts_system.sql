-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_user_id uuid REFERENCES auth.users(id) NOT NULL,
    target_id uuid NOT NULL,
    target_type text CHECK (target_type IN ('npc', 'user')) NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(owner_user_id, target_id)
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON public.contacts;
CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT USING (auth.uid() = owner_user_id);

-- Policy: Users can insert their own contacts
DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
CREATE POLICY "Users can insert own contacts" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Users can delete their own contacts
DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = owner_user_id);

-- Update RLS on npcs table
-- First, drop existing policy if it conflicts or is too restrictive
DROP POLICY IF EXISTS "Users can view own npcs" ON public.npcs;
DROP POLICY IF EXISTS "Users can view accessible npcs" ON public.npcs;

-- New comprehensive policy for NPCs
CREATE POLICY "Users can view accessible npcs" ON public.npcs
    FOR SELECT USING (
        user_id = auth.uid() -- Owner
        OR
        is_public = true -- Public NPCs
        OR
        EXISTS ( -- In contacts
            SELECT 1 FROM public.contacts
            WHERE contacts.owner_user_id = auth.uid()
            AND contacts.target_id = npcs.id
            AND contacts.target_type = 'npc'
        )
        OR
        EXISTS ( -- Shared in a group
             SELECT 1 FROM public.group_members gm_user
             JOIN public.group_members gm_npc ON gm_user.group_id = gm_npc.group_id
             WHERE gm_user.member_id = auth.uid()
             AND gm_npc.member_id = npcs.id
        )
    );
