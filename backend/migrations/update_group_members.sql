-- ===============================================================
-- AGGIORNAMENTO TABELLA GROUP_MEMBERS
-- ===============================================================
-- Aggiunge supporto per membri di tipo 'user' o 'ai'
-- e sistema di ruoli (owner, admin, member)

-- Prima verifica se la tabella esiste già
CREATE TABLE IF NOT EXISTS group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(50) NOT NULL,
  member_id VARCHAR(50) NOT NULL,
  member_type ENUM('user','ai') NOT NULL DEFAULT 'ai',
  role ENUM('owner','admin','member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_group (group_id),
  INDEX idx_member (member_id, member_type),
  UNIQUE KEY unique_member (group_id, member_id, member_type)
);

-- Se la tabella esiste già, aggiungi le colonne mancanti
ALTER TABLE group_members 
  ADD COLUMN IF NOT EXISTS member_type ENUM('user','ai') NOT NULL DEFAULT 'ai' AFTER member_id,
  ADD COLUMN IF NOT EXISTS role ENUM('owner','admin','member') DEFAULT 'member' AFTER member_type;

-- Migra i dati esistenti (girlfriend_id → member_id con type='ai')
-- Nota: Questo è sicuro solo se girlfriend_id esiste
UPDATE group_members 
SET member_id = girlfriend_id, member_type = 'ai' 
WHERE girlfriend_id IS NOT NULL AND member_id IS NULL;

-- ===============================================================
-- RUOLI:
-- - owner: creatore del gruppo, controllo totale
-- - admin: può invitare/rimuovere membri, modificare impostazioni
-- - member: può solo chattare
-- ===============================================================
