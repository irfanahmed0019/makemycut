import { Link } from 'react-router-dom';
import { Globe, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLanguage, type Lang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const LANGS: { code: Lang; label: string; full: string }[] = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'ml', label: 'ML', full: 'Malayalam' },
  { code: 'hi', label: 'HI', full: 'Hindi' },
];

export const DirectoryNavbar = () => {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <header className="w-full px-4 py-3 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <Link to="/" className="font-display font-bold text-xl text-foreground">
        MakeMyCut
      </Link>
      <div className="flex items-center gap-2">
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Change language"
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">{current.label}</span>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl overflow-hidden shadow-premium min-w-[140px] z-50">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${
                    l.code === lang ? 'text-primary font-medium' : 'text-foreground'
                  }`}
                >
                  {l.label} — {l.full}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link
          to={user ? '/' : '/auth'}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Profile"
        >
          <User className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
};