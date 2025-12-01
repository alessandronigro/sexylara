-- Ensure legacy compatibility column on conversations
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS girlfriend_id uuid;

-- Backfill legacy column from npc_id if empty
UPDATE public.conversations
SET girlfriend_id = npc_id
WHERE girlfriend_id IS NULL;

-- Sync trigger: keep npc_id and girlfriend_id aligned
CREATE OR REPLACE FUNCTION public.conversations_sync_npc() RETURNS trigger AS $$
BEGIN
    IF NEW.girlfriend_id IS NULL THEN
        NEW.girlfriend_id := NEW.npc_id;
    END IF;
    IF NEW.npc_id IS NULL THEN
        NEW.npc_id := NEW.girlfriend_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_conversations_sync ON public.conversations;
CREATE TRIGGER trg_conversations_sync
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.conversations_sync_npc();
