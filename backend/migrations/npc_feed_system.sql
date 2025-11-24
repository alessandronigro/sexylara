-- -------------------------------------------------
-- NPC Feed System – Supabase migration
-- -------------------------------------------------

-- 1️⃣  POST SYSTEM
CREATE TABLE IF NOT EXISTS npc_posts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    npc_id            UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
    media_type        TEXT NOT NULL CHECK (media_type IN ('photo','video','audio')),
    media_url         TEXT NOT NULL,
    caption           TEXT,
    tags              TEXT[],
    visibility        TEXT NOT NULL CHECK (visibility IN ('public','friends','private')),
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2️⃣  COMMENT SYSTEM
CREATE TABLE IF NOT EXISTS npc_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES npc_posts(id) ON DELETE CASCADE,
    author_user_id   UUID,
    author_npc_id    UUID,
    content           TEXT NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT comment_author_chk CHECK (
        (author_user_id IS NOT NULL AND author_npc_id IS NULL) OR
        (author_user_id IS NULL AND author_npc_id IS NOT NULL)
    )
);

-- 3️⃣  LIKE SYSTEM
CREATE TABLE IF NOT EXISTS npc_likes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES npc_posts(id) ON DELETE CASCADE,
    liker_user_id     UUID,
    liker_npc_id      UUID,
    CONSTRAINT like_author_chk CHECK (
        (liker_user_id IS NOT NULL AND liker_npc_id IS NULL) OR
        (liker_user_id IS NULL AND liker_npc_id IS NOT NULL)
    ),
    UNIQUE (post_id, liker_user_id, liker_npc_id)
);

-- 4️⃣  GROUP INVITE FROM POST
CREATE TABLE IF NOT EXISTS group_invites_from_post (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_id                 UUID NOT NULL REFERENCES girlfriends(id) ON DELETE CASCADE,
    group_id               UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    requested_by_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at           TIMESTAMPTZ
);

-- 5️⃣  NPC SETTINGS / PRIVACY
CREATE TABLE IF NOT EXISTS npc_settings (
    npc_id                     UUID PRIMARY KEY REFERENCES girlfriends(id) ON DELETE CASCADE,
    allow_feed_posts           BOOLEAN NOT NULL DEFAULT TRUE,
    allow_comment_replies      BOOLEAN NOT NULL DEFAULT FALSE,
    allow_sharing_to_groups    BOOLEAN NOT NULL DEFAULT TRUE,
    allow_like_responses       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_posts_timestamp   ON npc_posts (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post    ON npc_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post       ON npc_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_npc ON group_invites_from_post (npc_id, status);

-- -------------------------------------------------
-- PL/pgSQL function for trending posts
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION get_trending_posts()
RETURNS TABLE (
    id UUID,
    owner_user_id UUID,
    npc_id UUID,
    media_type TEXT,
    media_url TEXT,
    caption TEXT,
    visibility TEXT,
    timestamp TIMESTAMPTZ,
    score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.owner_user_id,
    p.npc_id,
    p.media_type,
    p.media_url,
    p.caption,
    p.visibility,
    p.timestamp,
    (COALESCE(l.like_cnt,0) + COALESCE(c.comment_cnt,0))
      / NULLIF(EXTRACT(EPOCH FROM (now() - p.timestamp))/3600.0,  -- ore
      AS score
  FROM npc_posts p
  LEFT JOIN (
    SELECT post_id, COUNT(*) AS like_cnt FROM npc_likes GROUP BY post_id
  ) l ON l.post_id = p.id
  LEFT JOIN (
    SELECT post_id, COUNT(*) AS comment_cnt FROM npc_comments GROUP BY post_id
  ) c ON c.post_id = p.id
  ORDER BY score DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- -------------------------------------------------
-- End of migration
-- -------------------------------------------------
