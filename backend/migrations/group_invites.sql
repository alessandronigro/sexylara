-- ===============================================================
-- TABELLA PER INVITI AI GRUPPI
-- ===============================================================
-- Gestisce gli inviti per aggiungere utenti reali o AI ai gruppi

CREATE TABLE IF NOT EXISTS group_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id VARCHAR(50) NOT NULL,
  invited_id VARCHAR(50) NOT NULL,         -- ID utente o AI
  invited_type ENUM('user', 'ai') NOT NULL,
  invited_by VARCHAR(50) NOT NULL,         -- Chi effettua l'invito
  status ENUM('pending','accepted','declined') DEFAULT 'pending',
  message TEXT,                             -- Messaggio opzionale dell'invito
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_group (group_id),
  INDEX idx_invited (invited_id, invited_type),
  INDEX idx_status (status),
  UNIQUE KEY unique_invite (group_id, invited_id, invited_type)
);

-- ===============================================================
-- WORKFLOW:
-- 1. Utente A invita Utente B o AI X al gruppo
-- 2. Record creato con status='pending'
-- 3. Se invitato è AI → accettazione automatica
-- 4. Se invitato è utente → riceve notifica, può accettare/rifiutare
-- ===============================================================
