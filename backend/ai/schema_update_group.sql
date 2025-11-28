-- Create npc_group_state table
CREATE TABLE IF NOT EXISTS npc_group_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  known_members UUID[] DEFAULT ARRAY[]::UUID[],
  first_intro_done BOOLEAN DEFAULT FALSE,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(npc_id, group_id)
);

-- Add group_behavior_profile to girlfriends table if not exists
-- Note: This requires a check or just try adding it.
ALTER TABLE girlfriends 
ADD COLUMN IF NOT EXISTS group_behavior_profile JSONB DEFAULT '{"talkFrequency": 0.25, "interruptStyle": "polite", "groupRole": "observer"}';

-- Trigger for updated_at
CREATE TRIGGER update_npc_group_state_updated_at BEFORE UPDATE ON npc_group_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE npc_group_state ENABLE ROW LEVEL SECURITY;
