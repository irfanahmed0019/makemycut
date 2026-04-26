import { useLanguage } from '@/contexts/LanguageContext';

export const TrustSection = () => {
  const { t } = useLanguage();
  const items = [
    { title: t('trust.noWaiting.title'), detail: t('trust.noWaiting.detail') },
    { title: t('trust.instant.title'), detail: t('trust.instant.detail') },
    { title: t('trust.verified.title'), detail: t('trust.verified.detail') },
  ];
  return (
    <section className="bg-card rounded-2xl p-8 mt-8 border border-border">
      <h2 className="text-base font-semibold text-foreground mb-6">{t('trust.heading')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.title}>
            <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
            <p className="text-[13px] text-muted-foreground mt-1">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};