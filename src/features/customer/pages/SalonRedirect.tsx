import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setPendingAction } from '@/features/directory/lib/pendingAction';

interface Props {
  action: 'book' | 'queue';
}

export default function SalonRedirect({ action }: Props) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const salonId = params.get('salon');
    const isUuid = typeof salonId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId);
    if (!isUuid) {
      toast({ variant: 'destructive', title: 'Invalid link' });
      navigate('/', { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('barbers')
        .select('id, name, image_url, address, district, area')
        .eq('id', salonId!)
        .eq('is_deleted', false)
        .maybeSingle();
      if (error || !data) {
        toast({ variant: 'destructive', title: 'Salon not found' });
        navigate('/', { replace: true });
        return;
      }
      setPendingAction({
        action,
        salon: {
          id: data.id,
          name: data.name,
          image_url: data.image_url ?? null,
          address: data.address ?? null,
          district: data.district ?? null,
          area: data.area ?? null,
        } as any,
      });
      navigate(`/?action=${action === 'book' ? 'book' : 'queue'}`, { replace: true });
    })();
  }, [params, action, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
}