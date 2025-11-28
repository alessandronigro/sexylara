----- BEGIN public_optimized_ddl.sql ----- -- DDL ottimizzato per schema public -- - Uniforma tutte le UUID su gen_random_uuid() (pgcrypto) -- - Aggiunge helper functions SECURITY DEFINER -- - Trigger per updated_at e template broadcast per realtime -- - Indici aggiuntivi per performance -- Nota: esegui in ambiente di staging prima della produzione.

-- Ensure pgcrypto is available CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ========================= -- ENUMS -- ========================= CREATE TYPE IF NOT EXISTS public.member_type_enum AS ENUM ('user', 'ai'); CREATE TYPE IF NOT EXISTS public.role_enum AS ENUM ('owner', 'admin', 'member');

-- ========================= -- TABLES -- =========================

CREATE TABLE IF NOT EXISTS public.npc_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups ( id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, name text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT groups_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.npcs ( id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, name text NOT NULL, avatar_url text, ethnicity text CHECK (ethnicity = ANY (ARRAY['latina','asian','european','african','mixed','other'])), body_type text CHECK (body_type = ANY (ARRAY['slim','curvy','athletic','petite','plus_size'])), hair_length text CHECK (hair_length = ANY (ARRAY['short','medium','long'])), hair_color text, eye_color text, height_cm integer, age integer, personality_type text CHECK (personality_type = ANY (ARRAY['sweet','sexy','shy','dominant','playful','romantic','mysterious'])), tone text DEFAULT 'flirty', characteristics jsonb DEFAULT '{}'::jsonb, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, voice_preview_url text, gender text DEFAULT 'female', CONSTRAINT npcs_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.conversations ( id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, npc_id uuid NOT NULL, last_message_preview text, last_message_at timestamptz DEFAULT now(), unread_count integer DEFAULT 0, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT conversations_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.messages ( id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, session_id text NOT NULL, role text NOT NULL CHECK (role = ANY (ARRAY['user','assistant'])), type text NOT NULL, content text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, npc_id uuid, CONSTRAINT messages_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.group_members ( id uuid DEFAULT gen_random_uuid() NOT NULL, group_id uuid NOT NULL, member_id uuid, member_type public.member_type_enum DEFAULT 'ai', role public.role_enum DEFAULT 'member', npc_id uuid, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT group_members_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.group_messages ( id uuid DEFAULT gen_random_uuid() NOT NULL, group_id uuid NOT NULL, sender_id uuid NOT NULL, type text NOT NULL CHECK (type = ANY (ARRAY['text','image','video','audio'])), content text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT group_messages_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.group_invites ( id uuid DEFAULT gen_random_uuid() NOT NULL, group_id uuid NOT NULL, invited_id uuid NOT NULL, invited_type text NOT NULL CHECK (invited_type = ANY (ARRAY['user','ai'])), invited_by uuid NOT NULL, message text, status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','accepted','declined'])), created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT group_invites_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.invites ( id uuid DEFAULT gen_random_uuid() NOT NULL, group_id uuid, sender_id uuid, receiver_id uuid NOT NULL, receiver_type text NOT NULL CHECK (receiver_type = ANY (ARRAY['user','npc'])), status text CHECK (status = ANY (ARRAY['pending','accepted','rejected','cancelled'])), context text, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT invites_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.webhook_logs ( id uuid DEFAULT gen_random_uuid() NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL, received_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT webhook_logs_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.chat_memory ( chat_id uuid NOT NULL, summary text, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT chat_memory_pkey PRIMARY KEY (chat_id) );

COMMENT ON TABLE public.chat_memory IS 'Memoria sintetica a lungo termine per ogni chat AI'; COMMENT ON COLUMN public.chat_memory.chat_id IS 'ID della chat (corrisponde a npc_id)'; COMMENT ON COLUMN public.chat_memory.summary IS 'Riassunto sintetico della conversazione e relazione';

CREATE TABLE IF NOT EXISTS public.group_memory ( group_id uuid NOT NULL, summary text, dynamics jsonb DEFAULT '{}'::jsonb, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT group_memory_pkey PRIMARY KEY (group_id) );

COMMENT ON TABLE public.group_memory IS 'Memoria collettiva e dinamiche sociali del gruppo AI';

CREATE TABLE IF NOT EXISTS public.ai_contacts ( id varchar NOT NULL, owner_id varchar NOT NULL, name varchar NOT NULL, avatar text, personality text, style text, tone varchar, age integer, gender varchar, description text, is_public boolean DEFAULT false, rating numeric DEFAULT 0.00, usage_count integer DEFAULT 0, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT ai_contacts_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.user_profile ( id uuid NOT NULL, username text, tone text DEFAULT 'playful', likes text[], dislikes text[], memory jsonb, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT user_profile_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.user_credits ( user_id uuid NOT NULL, credits integer DEFAULT 0, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT user_credits_pkey PRIMARY KEY (user_id) );

CREATE TABLE IF NOT EXISTS public.payments ( id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid, stripe_session_id text NOT NULL, credits integer NOT NULL, status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','paid','failed'])), created_at timestamptz DEFAULT now() NOT NULL, amount varchar NOT NULL, CONSTRAINT payments_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.npc_posts ( id uuid DEFAULT gen_random_uuid() NOT NULL, npc_id uuid NOT NULL, caption text, media_url text, media_type varchar DEFAULT 'image', created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT npc_posts_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.npc_ratings ( id uuid DEFAULT gen_random_uuid() NOT NULL, npc_id uuid NOT NULL, user_id uuid NOT NULL, rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5), created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT npc_ratings_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.post_likes ( id uuid DEFAULT gen_random_uuid() NOT NULL, post_id uuid NOT NULL, user_id uuid NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT post_likes_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.post_comments ( id uuid DEFAULT gen_random_uuid() NOT NULL, post_id uuid NOT NULL, user_id uuid NOT NULL, comment text NOT NULL, created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT post_comments_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.user_memory ( user_id uuid NOT NULL, preferences jsonb DEFAULT '{}'::jsonb, personality_traits jsonb DEFAULT '{}'::jsonb, life_events text[] DEFAULT ARRAY[]::text[], interests text[] DEFAULT ARRAY[]::text[], emotional_state text DEFAULT 'neutral', conversation_style text DEFAULT 'casual', created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT user_memory_pkey PRIMARY KEY (user_id) );

CREATE TABLE IF NOT EXISTS public.ai_user_memory ( id uuid DEFAULT gen_random_uuid() NOT NULL, ai_id uuid NOT NULL, user_id uuid NOT NULL, last_interaction timestamptz, relationship_level integer DEFAULT 0 CHECK (relationship_level >= 0 AND relationship_level <= 100), trust_level integer DEFAULT 50 CHECK (trust_level >= 0 AND trust_level <= 100), affection_level integer DEFAULT 50 CHECK (affection_level >= 0 AND affection_level <= 100), shared_experiences text[] DEFAULT ARRAY[]::text[], inside_jokes text[] DEFAULT ARRAY[]::text[], topics_discussed text[] DEFAULT ARRAY[]::text[], user_preferences_learned jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT ai_user_memory_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.ai_relations ( id uuid DEFAULT gen_random_uuid() NOT NULL, ai_id_1 uuid NOT NULL, ai_id_2 uuid NOT NULL, group_id uuid, relationship_type text DEFAULT 'neutral', affinity_level integer DEFAULT 50 CHECK (affinity_level >= 0 AND affinity_level <= 100), tension_level integer DEFAULT 0 CHECK (tension_level >= 0 AND tension_level <= 100), shared_moments text[] DEFAULT ARRAY[]::text[], created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT ai_relations_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.significant_events ( id uuid DEFAULT gen_random_uuid() NOT NULL, ai_id uuid, user_id uuid, group_id uuid, event_type text NOT NULL, description text NOT NULL, emotional_impact text DEFAULT 'medium', created_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT significant_events_pkey PRIMARY KEY (id) );

CREATE TABLE IF NOT EXISTS public.ai_personality_evolution ( id uuid DEFAULT gen_random_uuid() NOT NULL, ai_id uuid NOT NULL, user_id uuid, extroversion integer DEFAULT 50 CHECK (extroversion >= 0 AND extroversion <= 100), humor integer DEFAULT 50 CHECK (humor >= 0 AND humor <= 100), empathy integer DEFAULT 50 CHECK (empathy >= 0 AND empathy <= 100), assertiveness integer DEFAULT 50 CHECK (assertiveness >= 0 AND assertiveness <= 100), playfulness integer DEFAULT 50 CHECK (playfulness >= 0 AND playfulness <= 100), curiosity integer DEFAULT 50 CHECK (curiosity >= 0 AND curiosity <= 100), jealousy integer DEFAULT 30 CHECK (jealousy >= 0 AND jealousy <= 100), loyalty integer DEFAULT 70 CHECK (loyalty >= 0 AND loyalty <= 100), created_at timestamptz DEFAULT now() NOT NULL, updated_at timestamptz DEFAULT now() NOT NULL, CONSTRAINT ai_personality_evolution_pkey PRIMARY KEY (id) );

-- ========================= -- FOREIGN KEYS -- (Left as comments if auth.users not present; enable if auth.users exists) -- =========================

-- Example enabling FK if auth.users exists: -- ALTER TABLE public.npcs -- ADD CONSTRAINT npcs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Add FK constraints below when you're ready (optional) -- (I left these commented to avoid migration failure if auth.users missing)

-- ========================= -- INDEXES (performance) -- =========================

CREATE INDEX IF NOT EXISTS idx_npcs_user_id ON public.npcs(user_id); CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id); CREATE INDEX IF NOT EXISTS idx_conversations_gf_id ON public.conversations(npc_id); CREATE INDEX IF NOT EXISTS idx_messages_gf_id ON public.messages(npc_id); CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id); CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id); CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id); CREATE INDEX IF NOT EXISTS idx_ai_user_memory_ai_id ON public.ai_user_memory(ai_id); CREATE INDEX IF NOT EXISTS idx_ai_relations_ai1 ON public.ai_relations(ai_id_1); CREATE INDEX IF NOT EXISTS idx_ai_relations_ai2 ON public.ai_relations(ai_id_2); CREATE INDEX IF NOT EXISTS idx_user_profile_username ON public.user_profile( (lower(username)) ); CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON public.user_memory(user_id); CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id); CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);

-- Partial index example for unread conversations (fast lookup) CREATE INDEX IF NOT EXISTS idx_conversations_unread ON public.conversations (user_id, unread_count) WHERE unread_count > 0;

-- ========================= -- TRIGGERS: updated_at automatic maintenance -- =========================

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END;

-- Attach trigger to tables with updated_at DO $$ DECLARE tbl text; BEGIN FOR tbl IN SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public' LOOP EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', tbl); EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl); END LOOP; END;

-- ========================= -- Realtime broadcast trigger template -- =========================

CREATE OR REPLACE FUNCTION public.broadcast_changes_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM realtime.broadcast_changes( 'public:' || TG_TABLE_NAME || ':' || COALESCE(NEW.id::text, OLD.id::text), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD ); RETURN COALESCE(NEW, OLD); END;

-- Note: attach the trigger only on tables you want to broadcast (and ensure private channels) -- Example: -- CREATE TRIGGER messages_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.messages -- FOR EACH ROW EXECUTE FUNCTION public.broadcast_changes_trigger();

-- ========================= -- SECURITY DEFINER HELPERS -- =========================

-- Example helper: return auth.uid() safely for use in policies CREATE OR REPLACE FUNCTION public.current_auth_uid() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT auth.uid();

REVOKE EXECUTE ON FUNCTION public.current_auth_uid() FROM anon, authenticated;

-- Example helper: check if user is member of a group CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.group_members gm WHERE gm.group_id = p_group_id AND gm.member_id = p_user_id);

REVOKE EXECUTE ON FUNCTION public.is_group_member FROM anon, authenticated;

-- ========================= -- RLS SUGGESTIONS (commented) -- If you want, I can enable these for you. They are minimal and secure. -- =========================

/* -- Enable RLS example: ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY; CREATE POLICY "npcs_owner_only" ON public.npcs FOR ALL TO authenticated USING ((SELECT public.current_auth_uid()) = user_id) WITH CHECK ((SELECT public.current_auth_uid()) = user_id);*

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY; CREATE POLICY "messages_owner" ON public.messages FOR SELECT TO authenticated USING ( (SELECT public.current_auth_uid()) = user_id OR npc_id IN ( SELECT id FROM public.npcs WHERE user_id = (SELECT public.current_auth_uid()) ));

-- Note: test policies thoroughly. I can enable and tailor them on request. /

-- ========================= -- MAINTENANCE SUGGESTIONS -- ========================= -- - Run VACUUM ANALYZE periodically (autovacuum recommended). -- - Consider pg_stat_statements for query insights (already installed). -- - Add appropriate FK constraints when auth.users is present. -- - Consider partitioning very large tables (messages, group_messages) by time or conversation_id.

-- ========================= -- FINAL NOTES -- =========================
