-- Add is_public column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Add is_public column to girlfriends table
ALTER TABLE girlfriends ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Index for faster discovery
CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public);
CREATE INDEX IF NOT EXISTS idx_girlfriends_is_public ON girlfriends(is_public);
