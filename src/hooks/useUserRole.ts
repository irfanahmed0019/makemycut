import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'barber' | 'owner' | 'customer';

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>('customer');
  const [chairId, setChairId] = useState<string | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        setRole('customer');
        setLoading(false);
        return;
      }
      const [{ data: roles }, { data: assignment }, { data: ownedBarber }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('barber_assignments').select('chair_id, salon_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('barbers').select('id').eq('owner_id', user.id).maybeSingle(),
      ]);
      const roleList = (roles || []).map((r: any) => r.role);
      if (roleList.includes('admin')) setRole('admin');
      else if (assignment) {
        setRole('barber');
        setChairId(assignment.chair_id);
        setSalonId(assignment.salon_id);
      } else if (ownedBarber) setRole('owner');
      else setRole('customer');
      setLoading(false);
    };
    if (!authLoading) check();
  }, [user, authLoading]);

  return { role, chairId, salonId, loading: loading || authLoading, user };
};