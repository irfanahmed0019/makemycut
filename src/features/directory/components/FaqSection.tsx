import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FAQS = [
  {
    q: 'How do I join a queue?',
    a: 'Tap Join Queue on any salon. You will get a live position number instantly.',
  },
  {
    q: 'Can I book in advance?',
    a: 'Yes. Tap Book to choose a date and time slot at any listed salon.',
  },
  {
    q: 'Is MakeMyCut free to use?',
    a: 'Yes. MakeMyCut is completely free for customers.',
  },
  {
    q: 'What if I need to cancel?',
    a: 'Open the Bookings tab and tap Cancel before your appointment time.',
  },
  {
    q: 'Which areas are covered?',
    a: 'We currently cover salons across Kerala. New areas are added every week.',
  },
];

export const FaqSection = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-foreground mb-2">{t('faq.heading')}</h2>
      <div>
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full py-4 flex items-center justify-between text-left"
              >
                <span className="text-[15px] font-medium text-foreground">{item.q}</span>
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
                <p className="text-sm text-muted-foreground pb-4">{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};