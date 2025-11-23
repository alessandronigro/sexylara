-- ===============================================================
-- TABELLA PER TRACCIARE I CONTATTI AI CONDIVISIBILI
-- ===============================================================
-- Questa tabella permette agli utenti di creare AI contacts
-- che possono essere condivisi pubblicamente o mantenuti privati

CREATE TABLE IF NOT EXISTS ai_contacts (
  id VARCHAR(50) PRIMARY KEY,
  owner_id VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar TEXT,
  personality TEXT,
  style TEXT,
  tone VARCHAR(50),
  age INT,
  gender VARCHAR(20),
  is_public BOOLEAN DEFAULT false,         -- Se true, visibile a tutti
  description TEXT,                         -- Descrizione pubblica dell'AI
  rating DECIMAL(3,2) DEFAULT 0.00,        -- Rating medio (0-5)
  usage_count INT DEFAULT 0,                -- Quante volte è stato usato
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_owner (owner_id),
  INDEX idx_public (is_public),
  INDEX idx_rating (rating DESC)
);

-- ===============================================================
-- NOTA: Questa tabella può essere popolata da:
-- 1. Nuovi AI creati dagli utenti specificamente come "contacts"
-- 2. Girlfriends esistenti che vengono "condivise" come contacts
-- ===============================================================
