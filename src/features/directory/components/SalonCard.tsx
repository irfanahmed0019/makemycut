import { useState } from 'react';
import { Button } from '@/components/ui/button';
import salonPlaceholder from '/images/salon-placeholder.jpg';

export interface DirectorySalon {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
  is_verified: boolean | null;
  badge_type: string | null;
  status_tag: string | null;
  created_at: string | null;
}

const daysSince = (iso: string | null) => {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
};

export const computeBadge = (
  salon: DirectorySalon,
  cohortNewRatio: number,
): 'verified' | 'new' | 'featured' | 'popular' | null => {
  if (salon.badge_type) {
    return salon.badge_type as 'verified' | 'new' | 'featured' | 'popular';
  }
  if (salon.is_verified) return 'verified';
  if (cohortNewRatio < 0.3 && daysSince(salon.created_at) <= 30) return 'new';
  return null;
};

const BADGE_STYLES: Record<string, string> = {
  verified: 'bg-[hsl(120_40%_15%)] text-[hsl(141_71%_70%)] border-[hsl(120_30%_25%)]',
  new: 'bg-[hsl(240_40%_15%)] text-[hsl(234_85%_75%)] border-[hsl(240_30%_27%)]',
  featured: 'bg-[hsl(35_50%_12%)] text-[hsl(38_92%_55%)] border-[hsl(25_75%_25%)]',
  popular: 'bg-[hsl(280_40%_12%)] text-[hsl(270_95%_75%)] border-[hsl(280_55%_32%)]',
};

const STATUS_LABEL: Record<string, string> = {
  'open-now': 'Open Now',
  'closed-temporarily': 'Closed Temporarily',
  'coming-soon': 'Coming Soon',
};

const STATUS_STYLES: Record<string, string> = {
  'open-now': 'bg-[hsl(120_40%_15%)] text-[hsl(141_71%_70%)] border-[hsl(120_30%_25%)]',
  'closed-temporarily': 'bg-secondary text-muted-foreground border-border',
  'coming-soon': 'bg-[hsl(240_40%_15%)] text-[hsl(234_85%_75%)] border-[hsl(240_30%_27%)]',
};

interface SalonCardProps {
  salon: DirectorySalon;
  cohortNewRatio: number;
  onBook: (salon: DirectorySalon) => void;
  onJoinQueue: (salon: DirectorySalon) => void;
  bookingEnabled?: boolean;
  queueEnabled?: boolean;
  priority?: boolean;
}

export const SalonCard = ({
  salon,
  cohortNewRatio,
  onBook,
  onJoinQueue,
  bookingEnabled = true,
  queueEnabled = true,
  priority = false,
}: SalonCardProps) => {
  const [imgError, setImgError] = useState(false);
  const badge = computeBadge(salon, cohortNewRatio);
  const imgSrc = !imgError && salon.image_url ? salon.image_url : salonPlaceholder;

  return (
    <article className="bg-card rounded-2xl border border-border p-4 mb-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
      {badge && (
        <span
          className={`inline-block text-[11px] font-semibold px-2 py-[3px] rounded-full border mb-2 ${BADGE_STYLES[badge]}`}
        >
          {badge.charAt(0).toUpperCase() + badge.slice(1)}
        </span>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-xl font-bold text-foreground leading-tight">{salon.name}</h3>
          {salon.address && (
            <p className="text-[13px] text-muted-foreground mt-1 truncate">{salon.address}</p>
          )}
          {salon.status_tag && STATUS_LABEL[salon.status_tag] && (
            <span
              className={`inline-block text-[11px] font-semibold px-2 py-[3px] rounded-full border mt-2 ${STATUS_STYLES[salon.status_tag]}`}
            >
              {STATUS_LABEL[salon.status_tag]}
            </span>
          )}
        </div>
        <img
          src={imgSrc}
          alt={salon.name}
          width={80}
          height={80}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setImgError(true)}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
        />
      </div>
      <div className="flex flex-col md:flex-row gap-2 mt-3.5">
        {bookingEnabled && (
          <Button
            onClick={() => onBook(salon)}
            className="h-12 md:h-10 rounded-[10px] w-full md:w-auto md:px-5 font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            Book
          </Button>
        )}
        {queueEnabled && (
          <Button
            onClick={() => onJoinQueue(salon)}
            variant="outline"
            className="h-12 md:h-10 rounded-[10px] w-full md:w-auto md:px-5 border-primary text-primary hover:bg-primary/10 hover:text-primary font-semibold active:scale-[0.97] transition-transform duration-150"
          >
            Join Queue
          </Button>
        )}
      </div>
    </article>
  );
};