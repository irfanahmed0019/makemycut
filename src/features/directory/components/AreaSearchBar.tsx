import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Store, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAreaIndex } from '@/contexts/AreaIndexContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { capitalize } from '@/lib/slug';
import { supabase } from '@/integrations/supabase/client';

type SalonResult = { id: string; name: string; address: string | null };

export const AreaSearchBar = () => {
  const navigate = useNavigate();
  const { areas } = useAreaIndex();
  const { t } = useLanguage();
  const [raw, setRaw] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [salons, setSalons] = useState<SalonResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => setDebounced(raw.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [raw]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Salon name search
  useEffect(() => {
    if (!debounced) {
      setSalons([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('barbers')
        .select('id, name, address')
        .ilike('name', `%${debounced}%`)
        .eq('is_deleted', false)
        .limit(5);
      if (!cancelled) setSalons((data as SalonResult[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const results = useMemo(() => {
    if (!debounced) return [];
    const q = debounced;
    return areas
      .filter((a) => a.area.includes(q) || a.district.includes(q))
      .sort((a, b) => {
        const aExact = a.area === q ? 0 : a.area.startsWith(q) ? 1 : 2;
        const bExact = b.area === q ? 0 : b.area.startsWith(q) ? 1 : 2;
        return aExact - bExact;
      })
      .slice(0, 5);
  }, [areas, debounced]);

  const showDropdown = open && debounced.length > 0;

  const handleSelect = (entry: { district: string; area: string }) => {
    setOpen(false);
    setRaw('');
    navigate(`/salons/${entry.district}/${entry.area}`);
  };

  const handleSelectSalon = (salon: SalonResult) => {
    setOpen(false);
    setRaw('');
    navigate(`/book?salon=${salon.id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[600px] mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t('search.placeholder')}
          aria-label="Search salons and areas"
          className="w-full h-[52px] pl-11 pr-4 rounded-full bg-card border border-border text-foreground placeholder:text-muted-foreground text-[15px] focus:outline-none focus:border-primary transition-colors duration-150"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-premium z-50 overflow-hidden">
          {results.length === 0 && salons.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{t('search.empty')}</div>
          ) : (
            <ul role="listbox">
              {salons.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectSalon(s)}
                    className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-center gap-3"
                  >
                    <Store className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex flex-col min-w-0">
                      <span className="text-foreground text-sm font-medium truncate">{s.name}</span>
                      {s.address && (
                        <span className="text-muted-foreground text-xs truncate">{s.address}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {results.map((r) => (
                <li key={`${r.district}/${r.area}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors flex items-center gap-3"
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex flex-col min-w-0">
                      <span className="text-foreground text-sm font-medium">{capitalize(r.area)}</span>
                      <span className="text-muted-foreground text-xs">{capitalize(r.district)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};