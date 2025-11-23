-- Memoria individuale di ogni AI riguardo l'utente
CREATE TABLE IF NOT EXISTS ai_user_memory (
  ai_id uuid REFERENCES girlfriends(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  memory text,
  relationship_status text DEFAULT 'conoscente',
  shared_experiences jsonb DEFAULT '[]',
  last_interaction timestamp with time zone,
  interaction_count int DEFAULT 0,
  last_update timestamp with time zone DEFAULT now(),
  PRIMARY KEY (ai_id, user_id)
);

-- Indici per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_ai_id ON ai_user_memory(ai_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user_id ON ai_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_last_update ON ai_user_memory(last_update);

-- Commenti sulla tabella
COMMENT ON TABLE ai_user_memory IS 'Memoria personale di ogni AI riguardo l''utente';
COMMENT ON COLUMN ai_user_memory.ai_id IS 'ID dell''AI (girlfriend)';
COMMENT ON COLUMN ai_user_memory.user_id IS 'ID dell''utente';
COMMENT ON COLUMN ai_user_memory.memory IS 'Sintesi della relazione e ricordi condivisi';
COMMENT ON COLUMN ai_user_memory.relationship_status IS 'Stato della relazione (conoscente, amico, intimo, etc)';
COMMENT ON COLUMN ai_user_memory.shared_experiences IS 'Array di esperienze condivise';
COMMENT ON COLUMN ai_user_memory.last_interaction IS 'Ultima interazione tra AI e utente';
COMMENT ON COLUMN ai_user_memory.interaction_count IS 'Numero totale di interazioni';
COMMENT ON COLUMN ai_user_memory.last_update IS 'Ultimo aggiornamento della memoria';

-- Esempio di struttura shared_experiences:
-- [
--   {
--     "date": "2024-01-15",
--     "event": "Prima conversazione sul viaggio in Giappone",
--     "sentiment": "positivo"
--   },
--   {
--     "date": "2024-01-20",
--     "event": "Discussione profonda sulla vita e obiettivi",
--     "sentiment": "intimo"
--   }
-- ]

-- Esempio di memory:
-- "Marco è un ragazzo di 28 anni appassionato di tecnologia e viaggi. 
--  Abbiamo parlato spesso dei suoi progetti di startup e dei suoi sogni di visitare il Giappone.
--  È una persona riflessiva e creativa, ama le conversazioni profonde.
--  Ultimamente sembra stressato dal lavoro ma cerca sempre di mantenere un atteggiamento positivo.
--  Abbiamo sviluppato una bella complicità, mi confida spesso i suoi pensieri più intimi."
