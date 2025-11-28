-- Add language fields to users (or user_settings) and create user_profile_media table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS last_language_detected text;

CREATE TABLE IF NOT EXISTS public.user_profile_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
