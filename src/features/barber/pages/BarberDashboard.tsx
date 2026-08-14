import { useEffect, useRef, useState } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQueueEnabled } from '@/hooks/useQueueEnabled';
import { WalkInPanel } from '@/features/salon/components/WalkInPanel';

type FeedItem = {
  id: string;
  kind: 'queue' | 'booking';
  name: string;
  phone?: string;
  serviceName?: string;
  serviceDuration?: number;
  chairId?: string | null;
  sortKey: string;
  badge?: string;
  timeLabel?: string;
  raw: any;
};

type ActiveSession = {
  itemId: string;
  kind: 'queue' | 'booking';
  name: string;
  serviceName?: string;
  durationSec: number;
  startedAt: number;
  bookingId?: string;
  queueId?: string;
};

const SESSION_KEY = 'mmc_barber_active_session_v1';
const DATA_CACHE_KEY = 'mmc_barber_data_cache_v1';

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(DATA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const fmtTime = (t: string) => {
  try {
    const [hh, mm] = t.split(':').map(Number);
    const d = new Date(); d.setHours(hh, mm, 0, 0);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return t; }
};

const dateKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DAY_TABS = [
  { offset: 0, label: 'Today' },
  { offset: 1, label: 'Tomorrow' },
  { offset: 2, label: 'Day After' },
];

export default function BarberDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { role, chairId, salonId, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queueEnabled = useQueueEnabled();

  const cache = readCache();
  const [allQueue, setAllQueue] = useState<any[]>(cache?.allQueue ?? []);
  const [myBookings, setMyBookings] = useState<any[]>(cache?.myBookings ?? []);
  const [allBookings, setAllBookings] = useState<any[]>(cache?.allBookings ?? []);
  const [dayBookings, setDayBookings] = useState<any[]>(cache?.dayBookings ?? []);
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [chairs, setChairs] = useState<any[]>(cache?.chairs ?? []);
  const [requests, setRequests] = useState<any[]>(cache?.requests ?? []);
  const [profilesById, setProfilesById] = useState<Record<string, { full_name: string | null; phone: string | null }>>(cache?.profilesById ?? {});
  const [completedToday, setCompletedToday] = useState<number>(cache?.completedToday ?? 0);
  const [hydrated, setHydrated] = useState<boolean>(!!cache);
  const [active, setActive] = useState<ActiveSession | null>(() => {
    try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const refreshTimer = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/salon-login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (active) localStorage.setItem(SESSION_KEY, JSON.stringify(active));
    else localStorage.removeItem(SESSION_KEY);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const fetchAll = async () => {
    if (!salonId) return;
    // Local calendar day — using the UTC date made "today" wrong after 5:30 AM IST rollover.
    const today = dateKey(0);
    const [{ data: qAll }, { data: cAll }, { data: reqs }, { data: doneQueue }, { data: bDays }, { data: doneWalkIns }] = await Promise.all([
      supabase.from('queues')
        .select('*, services:service_id(name), chairs:chair_id(chair_number, name)')
        .eq('salon_id', salonId)
        .in('status', ['waiting', 'serving'])
        .order('queue_position'),
      supabase.from('chairs').select('id, chair_number, name').eq('salon_id', salonId).eq('is_active', true).order('chair_number'),
      supabase.from('chair_transfer_requests').select('*').eq('status', 'pending')
        .or(`from_barber_id.eq.${user?.id},to_barber_id.eq.${user?.id}`),
      supabase.from('queues').select('id, chair_id')
        .eq('salon_id', salonId).eq('status', 'served')
        .gte('served_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('bookings')
        .select('id, user_id, chair_id, service_id, booking_date, booking_time, status, services:service_id(name, price, duration_minutes)')
        .eq('barber_id', salonId)
        .in('booking_date', [dateKey(0), dateKey(1), dateKey(2)])
        .order('booking_time', { ascending: true }),
      supabase.from('walk_ins').select('id, chair_id')
        .eq('salon_id', salonId).eq('status', 'completed')
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);
    const days = ((bDays || []) as any[]);
    // Today's active bookings are a subset of the 3-day fetch — no extra round trip.
    const bookings = days.filter(
      (b) => b.booking_date === today && ['upcoming', 'CONFIRMED', 'pending'].includes(b.status),
    );
    // Completed today = my chair's finished bookings (chairless legacy rows count too) + served walk-ins.
    const completedBookings = days.filter(
      (b) => b.booking_date === today && b.status === 'completed' && (!b.chair_id || b.chair_id === chairId),
    ).length;
    const completedQueue = ((doneQueue || []) as any[]).filter(
      (q) => !q.chair_id || q.chair_id === chairId,
    ).length;
    // Walk-ins completed at this chair count toward today's total too.
    const completedWalkIns = ((doneWalkIns || []) as any[]).filter(
      (w) => !w.chair_id || w.chair_id === chairId,
    ).length;
    const userIds = Array.from(new Set(days.map((b) => b.user_id).filter(Boolean)));
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
      (profs || []).forEach((p: any) => { profileMap[p.id] = { full_name: p.full_name, phone: p.phone }; });
    }
    const next = {
      allQueue: qAll || [],
      allBookings: bookings,
      myBookings: bookings.filter((b) => b.chair_id === chairId),
      dayBookings: days,
      chairs: cAll || [],
      requests: reqs || [],
      profilesById: profileMap,
      completedToday: completedBookings + completedQueue + completedWalkIns,
    };
    setProfilesById(next.profilesById);
    setAllQueue(next.allQueue);
    setAllBookings(next.allBookings);
    setMyBookings(next.myBookings);
    setDayBookings(next.dayBookings);
    setChairs(next.chairs);
    setRequests(next.requests);
    setCompletedToday(next.completedToday);
    setHydrated(true);
    try { sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
  };

  useEffect(() => {
    if (role !== 'barber' || !salonId) return;
    fetchAll();
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => fetchAll(), 400);
    };
    const channel = supabase
      .channel(`barber-${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `salon_id=eq.${salonId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `barber_id=eq.${salonId}` }, (payload: any) => {
        const d = payload?.new?.booking_date;
        if (d && [dateKey(0), dateKey(1), dateKey(2)].includes(d)) {
          toast({ title: 'New booking', description: 'A new appointment just came in.' });
        }
        scheduleRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `barber_id=eq.${salonId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chair_transfer_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_ins', filter: `salon_id=eq.${salonId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `salon_id=eq.${salonId}` }, scheduleRefresh)
      .subscribe();
    // Silent safety-net poll so the board never goes stale if a realtime frame is missed.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll();
    }, 30000);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, salonId, chairId]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleTransfer = async (item: FeedItem, toChairId: string) => {
    const { error } = await supabase.rpc('request_chair_transfer', {
      p_booking_id: item.kind === 'booking' ? item.id : null,
      p_queue_id: item.kind === 'queue' ? item.id : null,
      p_to_chair_id: toChairId,
    });
    if (error) { toast({ variant: 'destructive', title: 'Transfer failed', description: error.message }); return; }
    toast({ title: 'Transfer requested' });
    fetchAll();
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    const { error } = await supabase.rpc('respond_chair_transfer', { p_request_id: requestId, p_accept: accept });
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: accept ? 'Transfer accepted' : 'Transfer rejected' });
    fetchAll();
  };

  const startSession = async (item: FeedItem) => {
    if (active) { toast({ variant: 'destructive', title: 'Finish current session first' }); return; }
    const durationSec = Math.max(60, (item.serviceDuration ?? 30) * 60);
    if (item.kind === 'queue') {
      await supabase.from('queues').update({ status: 'serving', updated_at: new Date().toISOString() }).eq('id', item.id);
    }
    setActive({
      itemId: item.id,
      kind: item.kind,
      name: item.name,
      serviceName: item.serviceName,
      durationSec,
      startedAt: Date.now(),
      bookingId: item.kind === 'booking' ? item.id : undefined,
      queueId: item.kind === 'queue' ? item.id : undefined,
    });
    setNowMs(Date.now());
    fetchAll();
  };

  const finishSession = async () => {
    if (!active || !user) return;
    if (active.kind === 'queue' && active.queueId) {
      const { error } = await supabase.rpc('mark_queue_served', { p_queue_id: active.queueId, p_owner_id: user.id });
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    } else if (active.kind === 'booking' && active.bookingId) {
      const { error } = await supabase.from('bookings')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', active.bookingId);
      if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    }
    toast({ title: 'Session completed' });
    setActive(null);
    fetchAll();
  };

  const cancelSession = async () => {
    if (!active) return;
    if (active.kind === 'queue' && active.queueId) {
      await supabase.from('queues').update({ status: 'waiting', updated_at: new Date().toISOString() }).eq('id', active.queueId);
    }
    setActive(null);
    fetchAll();
  };

  const setBookingStatus = async (bookingId: string, status: 'completed' | 'no-show' | 'cancelled') => {
    const { data, error } = await supabase.from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('id');
    if (error) { toast({ variant: 'destructive', title: 'Update failed', description: error.message }); return; }
    if (!data || data.length === 0) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'This booking is not assigned to your salon.' });
      return;
    }
    setDayBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    toast({
      title: status === 'completed'
        ? 'Marked as served'
        : status === 'no-show'
        ? 'Cancelled by barber — marked as no-show'
        : 'Booking cancelled',
    });
    fetchAll();
  };

  if ((authLoading || roleLoading) && !hydrated) {
    return <PageSkeleton />;
  }

  if (role !== 'barber' && !roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div>
          <p className="mb-3">You don't have a barber assignment yet.</p>
          <Button onClick={() => navigate('/')}>Back to home</Button>
        </div>
      </div>
    );
  }

  const myChair = chairs.find((c) => c.id === chairId);
  const otherChairs = chairs.filter((c) => c.id !== chairId);
  const incoming = requests.filter((r) => r.to_barber_id === user?.id);
  const outgoing = requests.filter((r) => r.from_barber_id === user?.id);

  const myQueueItems: FeedItem[] = (queueEnabled ? allQueue || [] : [])
    .filter((q: any) => q.chair_id === chairId)
    .map((q: any) => ({
      id: q.id, kind: 'queue', name: q.customer_name, phone: q.customer_phone,
      serviceName: q.services?.name, chairId: q.chair_id,
      sortKey: `1-${String(q.queue_position).padStart(4, '0')}`, raw: q,
    }));

  const myBookingItems: FeedItem[] = (myBookings || []).map((b: any) => {
    const prof = profilesById[b.user_id];
    return {
      id: b.id, kind: 'booking',
      name: prof?.full_name || 'Customer',
      phone: prof?.phone || undefined,
      serviceName: b.services?.name,
      serviceDuration: b.services?.duration_minutes,
      chairId: b.chair_id,
      sortKey: `2-${b.booking_time}`,
      badge: 'Pre-booked',
      timeLabel: fmtTime(b.booking_time),
      raw: b,
    };
  });

  const myFeed = [...myQueueItems, ...myBookingItems]
    .filter((i) => !active || i.id !== active.itemId)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const groupedQ: Record<string, any[]> = {};
  if (queueEnabled) allQueue.forEach((q) => { const k = q.chair_id || 'unassigned'; (groupedQ[k] ||= []).push(q); });
  const groupedB: Record<string, any[]> = {};
  allBookings.forEach((b) => { const k = b.chair_id || 'unassigned'; (groupedB[k] ||= []).push(b); });

  const elapsedSec = active ? Math.floor((nowMs - active.startedAt) / 1000) : 0;
  const remainingSec = active ? Math.max(0, active.durationSec - elapsedSec) : 0;
  const overtime = !!(active && elapsedSec > active.durationSec);
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display italic font-semibold tracking-tight">Make My Cut</h1>
          <p className="text-sm text-muted-foreground">
            {myChair ? `Chair #${myChair.chair_number}${myChair.name ? ` — ${myChair.name}` : ''}` : 'No chair assigned'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={manualRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Badge variant="outline" className="border-primary/40 text-primary uppercase tracking-wider">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-2" />
            {myChair ? `Chair ${myChair.chair_number}` : 'Unassigned'}
          </Badge>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate('/salon-login'); }}>
            Logout
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        {incoming.length > 0 && (
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="border border-primary/50 rounded-lg p-3 flex items-center justify-between bg-primary/5">
                <div className="text-sm">
                  <p className="font-bold uppercase tracking-wider">Chair transfer request</p>
                  <p className="text-muted-foreground text-xs">Another barber wants to send a customer to your chair.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRespond(r.id, true)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleRespond(r.id, false)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="mine">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="mine">{queueEnabled ? 'Queue' : 'My List'}</TabsTrigger>
            <TabsTrigger value="walkin">Walk-In</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="all">All Chairs</TabsTrigger>
            <TabsTrigger value="summary">Today</TabsTrigger>
          </TabsList>

          <TabsContent value="walkin" className="mt-4">
            {salonId && <WalkInPanel salonId={salonId} chairId={chairId} />}
          </TabsContent>

          <TabsContent value="mine" className="space-y-3 mt-4">
            {!queueEnabled && (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg p-3">
                Walk-in queue is currently disabled by the admin. Only pre-booked appointments are shown.
              </p>
            )}
            {active && (
              <Card className="border-primary/60 bg-card">
                <CardContent className="p-5 space-y-4">
                  <div>
                    <Badge className="bg-primary/15 text-primary hover:bg-primary/15 uppercase text-[10px] tracking-widest">In Progress</Badge>
                    <h2 className="font-display text-3xl mt-2">{active.name}</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                      {active.serviceName || 'Service'} · {Math.round(active.durationSec / 60)} min
                    </p>
                  </div>
                  <div className={`font-display text-5xl tabular-nums ${overtime ? 'text-destructive' : 'text-primary'}`}>
                    {overtime ? '+' : ''}{mm}:{ss}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={finishSession} className="flex-1">Finish cut</Button>
                    <Button variant="outline" onClick={cancelSession}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground pt-2">
              {active ? 'Up Next' : 'Queue'} ({myFeed.length})
            </p>

            {myFeed.length === 0 && !active && (
              <p className="text-center text-muted-foreground py-8">No customers in your queue.</p>
            )}

            {myFeed.map((item, idx) => (
              <Card key={`${item.kind}-${item.id}`} className={item.kind === 'booking' ? 'border-dashed border-border' : ''}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium tabular-nums">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <p className="font-bold text-base">{item.name}</p>
                        {item.badge && (
                          <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px] tracking-wider">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.serviceName || 'No service'}
                        {item.timeLabel && <span className="ml-2">· {item.timeLabel}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => startSession(item)} disabled={!!active}>Start</Button>
                    {otherChairs.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => { const v = e.target.value; if (v) handleTransfer(item, v); e.target.value = ''; }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Transfer to chair…</option>
                        {otherChairs.map((c) => (
                          <option key={c.id} value={c.id}>#{c.chair_number}{c.name ? ` — ${c.name}` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {outgoing.length > 0 && (
              <div className="pt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Outgoing transfers</p>
                {outgoing.map((r) => (
                  <Card key={r.id} className="border-dashed">
                    <CardContent className="p-3 text-sm">Waiting for the other chair to accept…</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-2">
              {DAY_TABS.map((d) => (
                <Button
                  key={d.offset}
                  size="sm"
                  variant={dayOffset === d.offset ? 'default' : 'outline'}
                  onClick={() => setDayOffset(d.offset)}
                >
                  {d.label}
                </Button>
              ))}
            </div>

            {(() => {
              const key = dateKey(dayOffset);
              const list = dayBookings
                .filter((b) => b.booking_date === key)
                .sort((a, b) => String(a.booking_time).localeCompare(String(b.booking_time)));
              if (list.length === 0) {
                return <p className="text-center text-muted-foreground py-8">No bookings for this day.</p>;
              }
              return list.map((b) => {
                const prof = profilesById[b.user_id];
                const done = b.status === 'completed' || b.status === 'no-show' || b.status === 'cancelled';
                return (
                  <Card key={b.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-base">{prof?.full_name || 'Customer'}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {b.services?.name || 'Service'} · {fmtTime(b.booking_time)}
                          </p>
                          {prof?.phone && <p className="text-xs text-muted-foreground">{prof.phone}</p>}
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            b.status === 'completed'
                              ? 'border-green-500/50 text-green-500 uppercase text-[10px] tracking-wider'
                              : b.status === 'no-show' || b.status === 'cancelled'
                              ? 'border-destructive/50 text-destructive uppercase text-[10px] tracking-wider'
                              : 'border-primary/40 text-primary uppercase text-[10px] tracking-wider'
                          }
                        >
                          {b.status === 'completed'
                            ? 'Served'
                            : b.status === 'no-show'
                            ? 'Cancelled by barber · No-show'
                            : b.status === 'cancelled'
                            ? 'Cancelled'
                            : b.status}
                        </Badge>
                      </div>
                      {!done && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="flex-1" onClick={() => setBookingStatus(b.id, 'completed')}>Served</Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => setBookingStatus(b.id, 'no-show')}>No-show</Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setBookingStatus(b.id, 'cancelled')}>Cancel</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </TabsContent>

          <TabsContent value="all" className="space-y-4 mt-4">
            {chairs.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    Chair #{c.chair_number}{c.name ? ` · ${c.name}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(groupedQ[c.id] || []).length === 0 && (groupedB[c.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Empty</p>
                  ) : (
                    <>
                      {(groupedQ[c.id] || []).map((q) => (
                        <div key={q.id} className="text-sm border border-border rounded p-2 flex items-center justify-between">
                          <span>#{q.queue_position} · {q.customer_name}</span>
                          <span className="text-muted-foreground">{q.services?.name || ''}</span>
                        </div>
                      ))}
                      {(groupedB[c.id] || []).map((b) => {
                        const prof = profilesById[b.user_id];
                        return (
                          <div key={b.id} className="text-sm border border-dashed border-border rounded p-2 flex items-center justify-between">
                            <span>
                              <Badge variant="outline" className="mr-2 border-primary/40 text-primary text-[10px] uppercase">Pre-booked</Badge>
                              {prof?.full_name || 'Customer'}
                            </span>
                            <span className="text-muted-foreground">{fmtTime(b.booking_time)}</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <p className="font-display text-6xl text-primary">{completedToday}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Customers completed today</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
