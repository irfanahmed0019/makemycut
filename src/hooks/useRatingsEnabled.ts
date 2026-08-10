import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'ratings_enabled';
let cached: boolean | null = null;

/** Global admin switch that shows/hides salon ratings across the app. */
export const useRatingsEnabled = () => {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false);

  useEffect(() => {
    let active = true;
    supabase
      .from('app_settings')
      .select('bool_value')
      .eq('key', KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const value = data?.bool_value === true;
        cached = value;
        setEnabled(value);
      });
    return () => { active = false; };
  }, []);

  return enabled;
};

export const setRatingsEnabled = async (value: boolean) => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: KEY, bool_value: value }, { onConflict: 'key' });
  if (!error) cached = value;
  return error;
};
