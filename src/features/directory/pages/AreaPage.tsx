import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { capitalize, toSlug } from '@/lib/slug';
import { DirectoryNavbar } from '@/features/directory/components/DirectoryNavbar';
import { AreaSearchBar } from '@/features/directory/components/AreaSearchBar';
import { SalonCard, type DirectorySalon } from '@/features/directory/components/SalonCard';
import { TrustSection } from '@/features/directory/components/TrustSection';
import { FaqSection } from '@/features/directory/components/FaqSection';
import { JsonLd } from '@/features/directory/components/JsonLd';
import { setPendingAction } from '@/features/directory/lib/pendingAction';
import NotFound from '@/pages/NotFound';

const SITE = 'https://makemycut.vercel.app';

export default function AreaPage() {
  const params = useParams<{ district: string; area: string }>();
  const navigate = useNavigate();
  const district = toSlug(params.district ?? '');
  const area = toSlug(params.area ?? '');

  const [salons, setSalons] = useState<DirectorySalon[]>([]);
  const [nearby, setNearby] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, { booking_enabled: boolean; queue_enabled: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [areaExists, setAreaExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      const [salonsRes, anyAreaRes, nearbyRes] = await Promise.all([
        supabase
          .from('barbers')
          .select('id, name, address, image_url, is_verified, badge_type, status_tag, created_at')
          .eq('district', district)
          .eq('area', area)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('barbers')
          .select('id', { head: true, count: 'exact' })
          .eq('district', district)
          .eq('area', area),
        supabase.rpc('list_area_index'),
      ]);

      if (cancelled) return;

      const list = (salonsRes.data ?? []) as DirectorySalon[];
      setSalons(list);
      setAreaExists((anyAreaRes.count ?? 0) > 0 || list.length > 0);

      const ids = list.map((s) => s.id);
      if (ids.length) {
        const { data: settingsData } = await supabase
          .from('salon_settings')
          .select('salon_id, booking_enabled, queue_enabled')
          .in('salon_id', ids);
        const map: Record<string, { booking_enabled: boolean; queue_enabled: boolean }> = {};
        settingsData?.forEach((s) => {
          map[s.salon_id] = { booking_enabled: s.booking_enabled, queue_enabled: s.queue_enabled };
        });
        if (!cancelled) setSettings(map);
      }

      const nearbyAreas = ((nearbyRes.data ?? []) as { district: string; area: string }[])
        .filter((r) => r.district === district && r.area !== area)
        .map((r) => r.area);
      const dedup = Array.from(new Set(nearbyAreas));
      if (!cancelled) setNearby(dedup);

      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [district, area]);

  const cohortNewRatio = useMemo(() => {
    if (!salons.length) return 1;
    const newCount = salons.filter((s) => {
      if (!s.created_at) return false;
      const days = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length;
    return newCount / salons.length;
  }, [salons]);

  const handleBook = (salon: DirectorySalon) => {
    setPendingAction({ action: 'book', salon });
    navigate('/?action=book');
  };
  const handleQueue = (salon: DirectorySalon) => {
    setPendingAction({ action: 'queue', salon });
    navigate('/?action=queue');
  };

  if (areaExists === false && !loading) {
    return <NotFound />;
  }

  const areaLabel = capitalize(area);
  const districtLabel = capitalize(district);
  const title = `Best Salons in ${areaLabel}, ${districtLabel} | MakeMyCut`;
  const description = `Find and book top-rated salons in ${areaLabel}, ${districtLabel}. Instant booking and queue joining with MakeMyCut.`;
  const canonical = `${SITE}/salons/${district}/${area}`;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: salons.map((s, i) => ({
      '@type': 'HairSalon',
      position: i + 1,
      name: s.name,
      address: s.address ?? undefined,
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
      </Helmet>
      <JsonLd data={itemList} />

      <DirectoryNavbar />

      <main className="px-4 max-w-[800px] mx-auto pb-12">
        <section className="pt-10 pb-6">
          <h1 className="text-[28px] md:text-4xl font-bold text-foreground leading-tight">
            Best Salons in {areaLabel}, {districtLabel}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Skip the wait. Book instantly or join the queue.
          </p>
          <div className="mt-6">
            <AreaSearchBar />
          </div>
        </section>

        <p className="text-[13px] text-muted-foreground font-normal mb-4">
          Showing salons in {districtLabel}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-4 h-36 animate-pulse" />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-lg text-foreground font-semibold">No salons listed in {areaLabel} yet.</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We are expanding here soon. Check nearby areas in {districtLabel} below.
            </p>
          </div>
        ) : (
          <div>
            {salons.map((s, i) => (
              <SalonCard
                key={s.id}
                salon={s}
                cohortNewRatio={cohortNewRatio}
                onBook={handleBook}
                onJoinQueue={handleQueue}
                bookingEnabled={settings[s.id]?.booking_enabled !== false}
                queueEnabled={settings[s.id]?.queue_enabled !== false}
                priority={i === 0}
              />
            ))}
          </div>
        )}

        {nearby.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base font-semibold text-foreground mb-3">
              Other areas in {districtLabel}
            </h2>
            <div className="flex flex-wrap gap-2">
              {nearby.map((a) => (
                <Link
                  key={a}
                  to={`/salons/${district}/${a}`}
                  className="px-3 py-1.5 rounded-full bg-card border border-border text-sm text-foreground hover:border-primary transition-colors"
                >
                  {capitalize(a)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 prose prose-invert prose-sm max-w-none text-muted-foreground">
          <p>
            Looking for the best salons in {areaLabel}, {districtLabel}? MakeMyCut helps you discover trusted barbers and salons across {areaLabel} with instant online booking and live queue tracking — no more waiting in line. Whether you need a quick haircut, a beard trim, hair coloring, or a full grooming session, you can browse verified salons in {areaLabel} and book a slot in seconds.
          </p>
          <p>
            Every salon listed here is manually reviewed for quality and reliability, so you know what to expect before you walk in. Skip the queue by booking ahead, or join the queue digitally and get notified when it's your turn. MakeMyCut is built for {districtLabel} residents who value their time — pick a salon in {areaLabel}, choose a service, and confirm in under 10 seconds. New salons in {districtLabel} are added every week, so check back often or use the search above to find your favorite area.
          </p>
        </section>

        <TrustSection />
        <FaqSection />
      </main>
    </div>
  );
}