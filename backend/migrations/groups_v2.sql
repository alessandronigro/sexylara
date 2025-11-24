-- GROUPS: Tabella principale dei gruppi
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{"public": false, "allow_npc_invites": true}'::jsonb
);

-- GROUP_MEMBERS: Membri del gruppo (Utenti e NPC)
CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    member_id UUID NOT NULL, -- Può essere user_id o npc_id
    member_type TEXT NOT NULL CHECK (member_type IN ('user', 'npc')),
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, member_id)
);

-- INVITES: Inviti pendenti
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL, -- user_id o npc_id
    receiver_type TEXT NOT NULL CHECK (receiver_type IN ('user', 'npc')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    context TEXT, -- Messaggio opzionale di invito
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_member_id ON group_members(member_id);
CREATE INDEX IF NOT EXISTS idx_invites_receiver_id ON invites(receiver_id);
