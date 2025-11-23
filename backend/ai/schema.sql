-- AI BRAIN ENGINE - Database Schema
-- Esegui questo SQL su Supabase per creare le tabelle delle memorie

-- 1. MEMORIA UTENTE (profilo, preferenze, personalità)
CREATE TABLE IF NOT EXISTS user_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  personality_traits JSONB DEFAULT '{}',
  life_events TEXT[] DEFAULT ARRAY[]::TEXT[],
  interests TEXT[] DEFAULT ARRAY[]::TEXT[],
  emotional_state TEXT DEFAULT 'neutral',
  conversation_style TEXT DEFAULT 'casual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. MEMORIA AI-UTENTE (cosa l'AI sa/pensa di questo utente)
CREATE TABLE IF NOT EXISTS ai_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_level INTEGER DEFAULT 0 CHECK (relationship_level >= 0 AND relationship_level <= 100),
  trust_level INTEGER DEFAULT 50 CHECK (trust_level >= 0 AND trust_level <= 100),
  affection_level INTEGER DEFAULT 50 CHECK (affection_level >= 0 AND affection_level <= 100),
  shared_experiences TEXT[] DEFAULT ARRAY[]::TEXT[],
  inside_jokes TEXT[] DEFAULT ARRAY[]::TEXT[],
  topics_discussed TEXT[] DEFAULT ARRAY[]::TEXT[],
  user_preferences_learned JSONB DEFAULT '{}',
  last_interaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ai_id, user_id)
);

-- 3. MEMORIA DI GRUPPO
CREATE TABLE IF NOT EXISTS group_memory (
  group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  dynamics JSONB DEFAULT '{}',
  shared_history TEXT[] DEFAULT ARRAY[]::TEXT[],
  inside_jokes TEXT[] DEFAULT ARRAY[]::TEXT[],
  conflicts TEXT[] DEFAULT ARRAY[]::TEXT[],
  alliances TEXT[] DEFAULT ARRAY[]::TEXT[],
  group_mood TEXT DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. RELAZIONI TRA AI (nel gruppo)
CREATE TABLE IF NOT EXISTS ai_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id_1 UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
  ai_id_2 UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'neutral', -- friend, rival, romantic, neutral
  affinity_level INTEGER DEFAULT 50 CHECK (affinity_level >= 0 AND affinity_level <= 100),
  tension_level INTEGER DEFAULT 0 CHECK (tension_level >= 0 AND tension_level <= 100),
  shared_moments TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ai_id_1, ai_id_2, group_id),
  CHECK (ai_id_1 < ai_id_2) -- Evita duplicati (A-B = B-A)
);

-- 5. EVENTI SIGNIFICATIVI
CREATE TABLE IF NOT EXISTS significant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id UUID REFERENCES girlfriends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- affection_declaration, life_event, loss, achievement, etc
  description TEXT NOT NULL,
  emotional_impact TEXT DEFAULT 'medium', -- low, medium, high, very_high
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PERSONALITÀ EVOLUTIVA AI (parametri che cambiano nel tempo)
CREATE TABLE IF NOT EXISTS ai_personality_evolution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_id UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = personalità base
  extroversion INTEGER DEFAULT 50 CHECK (extroversion >= 0 AND extroversion <= 100),
  humor INTEGER DEFAULT 50 CHECK (humor >= 0 AND humor <= 100),
  empathy INTEGER DEFAULT 50 CHECK (empathy >= 0 AND empathy <= 100),
  assertiveness INTEGER DEFAULT 50 CHECK (assertiveness >= 0 AND assertiveness <= 100),
  playfulness INTEGER DEFAULT 50 CHECK (playfulness >= 0 AND playfulness <= 100),
  curiosity INTEGER DEFAULT 50 CHECK (curiosity >= 0 AND curiosity <= 100),
  jealousy INTEGER DEFAULT 30 CHECK (jealousy >= 0 AND jealousy <= 100),
  loyalty INTEGER DEFAULT 70 CHECK (loyalty >= 0 AND loyalty <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ai_id, user_id)
);

-- INDICI per performance
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_ai ON ai_user_memory(ai_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user ON ai_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_relations_group ON ai_relations(group_id);
CREATE INDEX IF NOT EXISTS idx_significant_events_user ON significant_events(user_id);
CREATE INDEX IF NOT EXISTS idx_significant_events_ai ON significant_events(ai_id);
CREATE INDEX IF NOT EXISTS idx_significant_events_group ON significant_events(group_id);

-- TRIGGER per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_memory_updated_at BEFORE UPDATE ON user_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_user_memory_updated_at BEFORE UPDATE ON ai_user_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_memory_updated_at BEFORE UPDATE ON group_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_relations_updated_at BEFORE UPDATE ON ai_relations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_personality_evolution_updated_at BEFORE UPDATE ON ai_personality_evolution
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - adatta in base alle tue policy
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE significant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_personality_evolution ENABLE ROW LEVEL SECURITY;

-- Policy base (modifica secondo le tue esigenze)
CREATE POLICY "Users can view their own memory" ON user_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory" ON user_memory
    FOR UPDATE USING (auth.uid() = user_id);

-- Aggiungi altre policy secondo necessità
