import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'barber' | 'owner' | 'customer';

type RoleInfo = { role: AppRole; chairId: string | null; salonId: string | null };

/** Module-level cache so role lookups survive remounts and token refreshes. */
const roleCache = new Map<string, RoleInfo>();
const inflight = new Map<string, Promise<RoleInfo>>();

const loadRole = async (userId: string): Promise<RoleInfo> => {
  const cached = roleCache.get(userId);
  if (cached) return cached;
  const existing = inflight.get(userId);
  if (existing) return existing;

  const promise = (async (): Promise<RoleInfo> => {
    const [rolesRes, assignmentRes, ownedRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('barber_assignments').select('chair_id, salon_id').eq('user_id', userId).eq('is_active', true).maybeSingle(),
      supabase.from('barbers').select('id').eq('owner_id', userId).maybeSingle(),
    ]);
    const { data: roles } = rolesRes;
    const { data: assignment } = assignmentRes;
    const { data: ownedBarber } = ownedRes;
    const roleList = (roles || []).map((r: any) => r.role);
    let info: RoleInfo = { role: 'customer', chairId: null, salonId: null };
    if (roleList.includes('admin')) info = { role: 'admin', chairId: null, salonId: null };
    else if (assignment) info = { role: 'barber', chairId: assignment.chair_id, salonId: assignment.salon_id };
    else if (ownedBarber) info = { role: 'owner', chairId: null, salonId: null };
    inflight.delete(userId);
    // Never cache a fallback that came from a failed lookup — that would lock
    // a real owner/barber out until a hard reload.
    const failed = !!(rolesRes.error || assignmentRes.error || ownedRes.error);
    if (!failed) roleCache.set(userId, info);
    return info;
  })();

  inflight.set(userId, promise);
  return promise;
};

/** Resolve a user's role on demand (awaitable, bypasses render timing). */
export const resolveUserRole = loadRole;

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const cached = userId ? roleCache.get(userId) : null;
  const [info, setInfo] = useState<RoleInfo>(cached ?? { role: 'customer', chairId: null, salonId: null });
  const [loading, setLoading] = useState(!cached);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setInfo({ role: 'customer', chairId: null, salonId: null });
      setLoading(false);
      return;
    }
    const hit = roleCache.get(userId);
    if (hit) {
      setInfo(hit);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadRole(userId).then((res) => {
      if (!mounted.current) return;
      setInfo(res);
      setLoading(false);
    });
    // Only depends on the user id — token refreshes create a new user object
    // but must not re-trigger a role lookup (that caused the loading flicker).
  }, [userId, authLoading]);

  return {
    role: info.role,
    chairId: info.chairId,
    salonId: info.salonId,
    loading: loading || authLoading || (!!userId && !roleCache.get(userId) && !cached),
    user,
  };
};

/** Clear cached roles (call on sign out or after role changes). */
export const clearRoleCache = (userId?: string) => {
  if (userId) roleCache.delete(userId);
  else roleCache.clear();
};