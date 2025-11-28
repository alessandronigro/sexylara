-- Memorizza la sintesi della conversazione (memoria a lungo termine)
CREATE TABLE IF NOT EXISTS chat_memory (
  chat_id uuid PRIMARY KEY,
  summary text,
  updated_at timestamp with time zone default now()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_chat_memory_updated_at ON chat_memory(updated_at);

-- Commento sulla tabella
COMMENT ON TABLE chat_memory IS 'Memoria sintetica a lungo termine per ogni chat AI';
COMMENT ON COLUMN chat_memory.chat_id IS 'ID della chat (corrisponde a npc_id)';
COMMENT ON COLUMN chat_memory.summary IS 'Riassunto sintetico della conversazione e relazione';
COMMENT ON COLUMN chat_memory.updated_at IS 'Ultimo aggiornamento della memoria';
