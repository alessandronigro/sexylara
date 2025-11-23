-- Memoria collettiva del gruppo (relazioni, eventi, dinamiche sociali)
CREATE TABLE IF NOT EXISTS group_memory (
  group_id uuid PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  summary text,
  dynamics jsonb DEFAULT '{}',
  updated_at timestamp with time zone DEFAULT now()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_group_memory_updated_at ON group_memory(updated_at);

-- Commenti sulla tabella
COMMENT ON TABLE group_memory IS 'Memoria collettiva e dinamiche sociali del gruppo AI';
COMMENT ON COLUMN group_memory.group_id IS 'ID del gruppo (FK a groups)';
COMMENT ON COLUMN group_memory.summary IS 'Riassunto narrativo della storia del gruppo';
COMMENT ON COLUMN group_memory.dynamics IS 'JSON con relazioni, simpatie, tensioni, leadership';
COMMENT ON COLUMN group_memory.updated_at IS 'Ultimo aggiornamento della memoria';

-- Esempio di struttura dynamics:
-- {
--   "relationships": {
--     "Lara-Mia": "amiche strette, condividono passione per viaggi",
--     "Sofia-Marco": "tensione leggera, opinioni politiche diverse"
--   },
--   "leadership": ["Lara", "Marco"],
--   "topics": ["viaggi", "cucina", "tecnologia"],
--   "mood": "positivo e collaborativo",
--   "events": [
--     "discussione animata su viaggi in Asia",
--     "battuta ricorrente sul caffè di Marco"
--   ]
-- }
