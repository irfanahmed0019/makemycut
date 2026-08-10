import { useEffect, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const FaqSection = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      setFaqs(data || []);
    })();
  }, []);

  if (faqs.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-foreground mb-2">{t('faq.heading')}</h2>
      <div>
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.id} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full py-4 flex items-center justify-between text-left"
              >
                <span className="text-[15px] font-medium text-foreground">{item.question}</span>
                {isOpen ? (
                  <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              <div
                style={{ maxHeight: isOpen ? 200 : 0 }}
                className="overflow-hidden transition-all duration-200 ease-in-out"
              >
                <p className="text-sm text-muted-foreground pb-4">{item.answer}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};