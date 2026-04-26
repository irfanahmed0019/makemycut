import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AreaEntry {
  district: string;
  area: string;
}

const FALLBACK: AreaEntry[] = [
  { district: 'trivandrum', area: 'attingal' },
  { district: 'trivandrum', area: 'kazhakkoottam' },
  { district: 'kollam', area: 'paravur' },
];

interface AreaIndexContextValue {
  areas: AreaEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const AreaIndexContext = createContext<AreaIndexContextValue | undefined>(undefined);

export const AreaIndexProvider = ({ children }: { children: ReactNode }) => {
  const [areas, setAreas] = useState<AreaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('barbers')
        .select('district, area')
        .eq('is_deleted', false)
        .not('district', 'is', null)
        .not('area', 'is', null);

      if (error || !data) {
        setAreas(FALLBACK);
      } else {
        const seen = new Set<string>();
        const deduped: AreaEntry[] = [];
        for (const row of data) {
          const key = `${row.district}/${row.area}`;
          if (!seen.has(key) && row.district && row.area) {
            seen.add(key);
            deduped.push({ district: row.district, area: row.area });
          }
        }
        setAreas(deduped.length ? deduped : FALLBACK);
      }
    } catch {
      setAreas(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AreaIndexContext.Provider value={{ areas, loading, refresh: load }}>
      {children}
    </AreaIndexContext.Provider>
  );
};

export const useAreaIndex = () => {
  const ctx = useContext(AreaIndexContext);
  if (!ctx) throw new Error('useAreaIndex must be used within AreaIndexProvider');
  return ctx;
};