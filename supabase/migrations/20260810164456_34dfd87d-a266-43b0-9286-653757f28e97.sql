ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS last_minute_alerts boolean NOT NULL DEFAULT false;