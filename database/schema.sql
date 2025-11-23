-- ============================================
-- SEXY LARA - DATABASE SCHEMA
-- Multi-Girlfriend AI Chat System
-- ============================================

-- ============================================
-- 1. GIRLFRIENDS TABLE
-- Store AI girlfriend profiles
-- ============================================
CREATE TABLE IF NOT EXISTS public.girlfriends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- Physical characteristics
    ethnicity TEXT, -- 'latina', 'asian', 'european', 'african', 'mixed'
    body_type TEXT, -- 'slim', 'curvy', 'athletic', 'petite', 'plus_size'
    hair_length TEXT, -- 'short', 'medium', 'long'
    hair_color TEXT, -- 'blonde', 'brunette', 'black', 'red', 'other'
    eye_color TEXT, -- 'brown', 'blue', 'green', 'hazel', 'gray'
    height_cm INTEGER, -- Height in centimeters
    age INTEGER, -- Apparent age
    
    -- Personality traits
    personality_type TEXT, -- 'sweet', 'sexy', 'shy', 'dominant', 'playful', 'romantic'
    tone TEXT DEFAULT 'flirty', -- Chat tone: 'flirty', 'romantic', 'explicit', 'friendly'
    
    -- Additional characteristics (JSON for flexibility)
    characteristics JSONB DEFAULT '{}',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_ethnicity CHECK (ethnicity IN ('latina', 'asian', 'european', 'african', 'mixed', 'other')),
    CONSTRAINT valid_body_type CHECK (body_type IN ('slim', 'curvy', 'athletic', 'petite', 'plus_size')),
    CONSTRAINT valid_hair_length CHECK (hair_length IN ('short', 'medium', 'long')),
    CONSTRAINT valid_personality CHECK (personality_type IN ('sweet', 'sexy', 'shy', 'dominant', 'playful', 'romantic', 'mysterious'))
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_girlfriends_user_id ON public.girlfriends(user_id);
CREATE INDEX IF NOT EXISTS idx_girlfriends_active ON public.girlfriends(user_id, is_active);

-- ============================================
-- 2. UPDATE MESSAGES TABLE
-- Add girlfriend_id to associate messages with specific girlfriend
-- ============================================
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS girlfriend_id UUID REFERENCES public.girlfriends(id) ON DELETE CASCADE;

-- Index for faster message queries by girlfriend
CREATE INDEX IF NOT EXISTS idx_messages_girlfriend ON public.messages(user_id, girlfriend_id, created_at DESC);

-- ============================================
-- 3. CONVERSATIONS TABLE
-- Track conversation metadata for each girlfriend
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    girlfriend_id UUID NOT NULL REFERENCES public.girlfriends(id) ON DELETE CASCADE,
    
    -- Conversation state
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one conversation per user-girlfriend pair
    CONSTRAINT unique_user_girlfriend UNIQUE(user_id, girlfriend_id)
);

-- Index for conversation list queries
CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.conversations(user_id, last_message_at DESC);

-- ============================================
-- 4. USER PREFERENCES (OPTIONAL)
-- Uncomment if user_preferences table exists
-- ============================================
-- ALTER TABLE public.user_preferences
-- ADD COLUMN IF NOT EXISTS default_girlfriend_id UUID REFERENCES public.girlfriends(id) ON DELETE SET NULL;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure users can only access their own data
-- ============================================

-- Enable RLS on girlfriends table
ALTER TABLE public.girlfriends ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own girlfriends" ON public.girlfriends;
DROP POLICY IF EXISTS "Users can create own girlfriends" ON public.girlfriends;
DROP POLICY IF EXISTS "Users can update own girlfriends" ON public.girlfriends;
DROP POLICY IF EXISTS "Users can delete own girlfriends" ON public.girlfriends;

-- Policy: Users can view their own girlfriends
CREATE POLICY "Users can view own girlfriends"
    ON public.girlfriends
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own girlfriends
CREATE POLICY "Users can create own girlfriends"
    ON public.girlfriends
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own girlfriends
CREATE POLICY "Users can update own girlfriends"
    ON public.girlfriends
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own girlfriends
CREATE POLICY "Users can delete own girlfriends"
    ON public.girlfriends
    FOR DELETE
    USING (auth.uid() = user_id);

-- Enable RLS on conversations table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;

-- Policy: Users can view their own conversations
CREATE POLICY "Users can view own conversations"
    ON public.conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own conversations
CREATE POLICY "Users can create own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON public.conversations
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON public.conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- Automatic updates for timestamps and conversation metadata
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for girlfriends table
DROP TRIGGER IF EXISTS update_girlfriends_updated_at ON public.girlfriends;
CREATE TRIGGER update_girlfriends_updated_at
    BEFORE UPDATE ON public.girlfriends
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert conversation record
    INSERT INTO public.conversations (user_id, girlfriend_id, last_message_at, last_message_preview, unread_count)
    VALUES (NEW.user_id, NEW.girlfriend_id, NEW.created_at, LEFT(NEW.content, 100), 
            CASE WHEN NEW.role = 'assistant' THEN 1 ELSE 0 END)
    ON CONFLICT (user_id, girlfriend_id) 
    DO UPDATE SET
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        unread_count = CASE 
            WHEN NEW.role = 'assistant' THEN public.conversations.unread_count + 1
            ELSE 0
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation when message is inserted
DROP TRIGGER IF EXISTS update_conversation_on_new_message ON public.messages;
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    WHEN (NEW.girlfriend_id IS NOT NULL)
    EXECUTE FUNCTION update_conversation_on_message();

-- ============================================
-- 7. SAMPLE DATA (OPTIONAL)
-- Create a default girlfriend for testing
-- ============================================

-- This will be executed by the app, not in this migration
-- Just keeping it here as reference

-- INSERT INTO public.girlfriends (user_id, name, ethnicity, body_type, hair_length, hair_color, personality_type)
-- VALUES (
--     auth.uid(),
--     'Lara',
--     'latina',
--     'curvy',
--     'long',
--     'brunette',
--     'sexy'
-- );

-- ============================================
-- NOTES FOR IMPLEMENTATION
-- ============================================

-- 1. When creating a new girlfriend:
--    - Generate avatar using Fooocus/Stable Diffusion
--    - Upload to Supabase Storage
--    - Store URL in avatar_url field

-- 2. When sending a message:
--    - Include girlfriend_id in the message
--    - Backend uses girlfriend's characteristics for personalized responses
--    - Conversation is automatically updated via trigger

-- 3. For the contacts list:
--    - Query conversations table ordered by last_message_at
--    - Join with girlfriends table to get avatar and name
--    - Show unread_count as badge

-- 4. For chat screen:
--    - Query messages filtered by girlfriend_id
--    - Reset unread_count when opening chat
--    - Use girlfriend's tone for AI responses
