-- Profilo utente completo per personalizzazione AI
CREATE TABLE IF NOT EXISTS user_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  age int,
  city text,
  bio text,
  traits jsonb DEFAULT '{}',
  preferences jsonb DEFAULT '{}',
  emotional_state text DEFAULT 'neutro',
  updated_at timestamp with time zone DEFAULT now()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_user_profile_updated_at ON user_profile(updated_at);

-- Commenti sulla tabella
COMMENT ON TABLE user_profile IS 'Profilo completo dell''utente per personalizzazione AI';
COMMENT ON COLUMN user_profile.user_id IS 'ID utente (FK a auth.users)';
COMMENT ON COLUMN user_profile.name IS 'Nome dell''utente';
COMMENT ON COLUMN user_profile.age IS 'Età dell''utente';
COMMENT ON COLUMN user_profile.city IS 'Città di residenza';
COMMENT ON COLUMN user_profile.bio IS 'Biografia/descrizione personale';
COMMENT ON COLUMN user_profile.traits IS 'Caratteristiche psicologiche fisse (es: introverso, creativo, sportivo)';
COMMENT ON COLUMN user_profile.preferences IS 'Preferenze (musica, hobby, stile conversazione)';
COMMENT ON COLUMN user_profile.emotional_state IS 'Stato emotivo attuale (felice, triste, stressato, eccitato, etc)';
COMMENT ON COLUMN user_profile.updated_at IS 'Ultimo aggiornamento del profilo';

-- Esempio di struttura traits:
-- {
--   "personality": ["introverso", "creativo", "analitico"],
--   "interests": ["tecnologia", "viaggi", "musica"],
--   "communication_style": "diretto",
--   "humor_level": "alto",
--   "openness": "molto aperto"
-- }

-- Esempio di struttura preferences:
-- {
--   "music_genres": ["rock", "jazz", "elettronica"],
--   "hobbies": ["fotografia", "cucina", "gaming"],
--   "conversation_topics": ["tecnologia", "filosofia", "arte"],
--   "ai_tone_preference": "flirty",
--   "response_length": "medio",
--   "formality": "informale"
-- }
