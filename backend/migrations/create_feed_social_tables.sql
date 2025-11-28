
-- Script SQL per creare le tabelle del sistema Feed & Social

-- Tabella per i rating degli NPC
CREATE TABLE IF NOT EXISTS npc_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(npc_id, user_id)
);

-- Indice per query veloci
CREATE INDEX IF NOT EXISTS idx_npc_ratings_npc_id ON npc_ratings(npc_id);
CREATE INDEX IF NOT EXISTS idx_npc_ratings_user_id ON npc_ratings(user_id);

-- Tabella per i like ai post
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES npc_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- Tabella per i commenti ai post
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES npc_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);

-- Tabella npc_posts (se non esiste già)
CREATE TABLE IF NOT EXISTS npc_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
    caption TEXT,
    media_url TEXT,
    media_type VARCHAR(50) DEFAULT 'image',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per npc_posts
CREATE INDEX IF NOT EXISTS idx_npc_posts_npc_id ON npc_posts(npc_id);
CREATE INDEX IF NOT EXISTS idx_npc_posts_created_at ON npc_posts(created_at DESC);

-- Vista per feed con conteggi (opzionale, per query più veloci)
CREATE OR REPLACE VIEW npc_posts_with_stats AS
SELECT 
    p.*,
    COALESCE(l.likes_count, 0) AS likes_count,
    COALESCE(c.comments_count, 0) AS comments_count
FROM npc_posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) AS likes_count
    FROM post_likes
    GROUP BY post_id
) l ON p.id = l.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS comments_count
    FROM post_comments
    GROUP BY post_id
) c ON p.id = c.post_id;

-- RLS (Row Level Security) - Opzionale ma raccomandato
-- Abilita RLS sulle tabelle

ALTER TABLE npc_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE npc_posts ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere
CREATE POLICY "Anyone can read npc_ratings" ON npc_ratings FOR SELECT USING (true);
CREATE POLICY "Anyone can read post_likes" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can read post_comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can read npc_posts" ON npc_posts FOR SELECT USING (true);

-- Policy: solo gli utenti autenticati possono inserire
CREATE POLICY "Authenticated users can insert ratings" ON npc_ratings 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert likes" ON post_likes 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert comments" ON post_comments 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can publish posts" ON npc_posts 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: gli utenti possono cancellare i propri contenuti
CREATE POLICY "Users can delete their own ratings" ON npc_ratings 
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON post_likes 
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON post_comments 
    FOR DELETE USING (auth.uid() = user_id);
