-- Add voice_preview_url column to girlfriends table
ALTER TABLE girlfriends 
ADD COLUMN IF NOT EXISTS voice_preview_url TEXT;

-- Add comment
COMMENT ON COLUMN girlfriends.voice_preview_url IS 'URL of the voice preview audio file for voice cloning';

-- Set default voice for existing npcs (optional)
UPDATE girlfriends 
SET voice_preview_url = 'https://tnxdohjldclgbyadgdnt.supabase.co/storage/v1/object/public/voice-masters/girlfriend_default_master.mp3'
WHERE voice_preview_url IS NULL;
