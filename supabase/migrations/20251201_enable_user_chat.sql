-- Enable User-to-User Chat in Messages and Conversations

-- 1. Modify messages table
-- Drop the NOT NULL constraint on npc_id if it exists (it seems to be implicit or enforced by code, but let's be safe)
ALTER TABLE public.messages ALTER COLUMN npc_id DROP NOT NULL;

-- Add recipient_user_id column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id);

-- 2. Modify conversations table
ALTER TABLE public.conversations ALTER COLUMN npc_id DROP NOT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id);

-- 3. Update RLS policies (Optional but recommended)
-- Ensure users can see messages where they are the recipient
CREATE POLICY "Users can view messages sent to them" ON public.messages
    FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can insert messages to other users" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Same for conversations
CREATE POLICY "Users can view conversations where they are recipient" ON public.conversations
    FOR SELECT USING (auth.uid() = recipient_user_id);
