-- Add trust_score column to profiles with default 10
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trust_score numeric DEFAULT 10;