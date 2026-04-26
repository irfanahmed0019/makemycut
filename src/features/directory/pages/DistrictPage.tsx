import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { capitalize, toSlug } from '@/lib/slug';
import { DirectoryNavbar } from '@/features/directory/components/DirectoryNavbar';
import { AreaSearchBar } from '@/features/directory/components/AreaSearchBar';
import { TrustSection } from '@/features/directory/components/TrustSection';
import { FaqSection } from '@/features/directory/components/FaqSection';
import NotFound from '@/pages/NotFound';

const SITE = 'https://makemycut.vercel.app';

export default function DistrictPage() {
  const { district: rawDistrict } = useParams<{ district: string }>();
  const district = toSlug(rawDistrict ?? '');
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('barbers')
        .select('area')
        .eq('district', district)
        .eq('is_deleted', false)
        .not('area', 'is', null);
      if (cancelled) return;
      const unique = Array.from(new Set((data ?? []).map((r) => r.area as string)));
      setAreas(unique);
      setExists(unique.length > 0);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [district]);

  if (exists === false && !loading) return <NotFound />;

  const districtLabel = capitalize(district);
  const title = `Top Salons in ${districtLabel} | MakeMyCut`;
  const description = `Explore the best salons across all areas in ${districtLabel}. Book instantly with MakeMyCut.`;
  const canonical = `${SITE}/salons/${district}`;

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

      <DirectoryNavbar />

      <main className="px-4 max-w-[800px] mx-auto pb-12">
        <section className="pt-10 pb-6">
          <h1 className="text-[28px] md:text-4xl font-bold text-foreground leading-tight">
            Top Salons in {districtLabel}
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Browse salons by area across {districtLabel}.
          </p>
          <div className="mt-6">
            <AreaSearchBar />
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border h-24 animate-pulse" />
            ))}
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No salons in {districtLabel} yet. We are coming here soon.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {areas.map((a) => (
              <Link
                key={a}
                to={`/salons/${district}/${a}`}
                className="bg-card rounded-2xl border border-border p-4 hover:border-primary transition-colors"
              >
                <span className="text-foreground font-medium">{capitalize(a)}</span>
                <p className="text-xs text-muted-foreground mt-1">View salons</p>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-10 prose prose-invert prose-sm max-w-none text-muted-foreground">
          <p>
            Discover the best salons in {districtLabel} on MakeMyCut. From classic barbershops to premium grooming studios, every neighborhood in {districtLabel} is covered. Pick an area above to see verified salons near you and book a slot in seconds — no calls, no waiting.
          </p>
        </section>

        <TrustSection />
        <FaqSection />
      </main>
    </div>
  );
}