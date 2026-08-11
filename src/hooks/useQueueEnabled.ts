import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'queue_enabled';
let cached: boolean | null = null;

/** Global admin kill-switch for the walk-in queue across the whole app. */
export const useQueueEnabled = () => {
  const [enabled, setEnabled] = useState<boolean>(cached ?? true);

  useEffect(() => {
    let active = true;
    supabase
      .from('app_settings')
      .select('bool_value')
      .eq('key', KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // Missing row means the queue has never been disabled.
        const value = data ? data.bool_value === true : true;
        cached = value;
        setEnabled(value);
      });
    return () => { active = false; };
  }, []);

  return enabled;
};

export const setQueueEnabled = async (value: boolean) => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: KEY, bool_value: value }, { onConflict: 'key' });
  if (!error) cached = value;
  return error;
};
