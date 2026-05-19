import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function BarberDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { role, chairId, salonId, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [myQueue, setMyQueue] = useState<any[]>([]);
  const [allQueue, setAllQueue] = useState<any[]>([]);
  const [chairs, setChairs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/salon-login');
  }, [user, authLoading, navigate]);

  const fetchAll = async () => {
    if (!salonId) return;
    const [{ data: qAll }, { data: cAll }, { data: reqs }] = await Promise.all([
      supabase.from('queues')
        .select('*, services:service_id(name), chairs:chair_id(chair_number, name)')
        .eq('salon_id', salonId)
        .in('status', ['waiting', 'serving'])
        .order('queue_position'),
      supabase.from('chairs').select('id, chair_number, name').eq('salon_id', salonId).eq('is_active', true).order('chair_number'),
      supabase.from('chair_transfer_requests').select('*').eq('status', 'pending')
        .or(`from_barber_id.eq.${user?.id},to_barber_id.eq.${user?.id}`),
    ]);
    setAllQueue(qAll || []);
    setMyQueue((qAll || []).filter((q: any) => q.chair_id === chairId));
    setChairs(cAll || []);
    setRequests(reqs || []);
  };

  useEffect(() => {
    if (role !== 'barber' || !salonId) return;
    fetchAll();
    const channel = supabase
      .channel(`barber-${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `salon_id=eq.${salonId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chair_transfer_requests' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, salonId, chairId]);

  const handleServed = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.rpc('mark_queue_served', { p_queue_id: id, p_owner_id: user.id });
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Marked as served' });
    fetchAll();
  };

  const handleTransfer = async (queueId: string, toChairId: string) => {
    const { error } = await supabase.rpc('request_chair_transfer', {
      p_booking_id: null, p_queue_id: queueId, p_to_chair_id: toChairId,
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

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (role !== 'barber') {
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

  const grouped: Record<string, any[]> = {};
  allQueue.forEach((q) => {
    const key = q.chair_id || 'unassigned';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Barber Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {myChair ? `Chair #${myChair.chair_number}${myChair.name ? ` — ${myChair.name}` : ''}` : 'No chair assigned'}
          </p>
        </div>
        <Button variant="outline" onClick={async () => { await signOut(); navigate('/salon-login'); }}>Logout</Button>
      </header>

      <main className="p-4">
        <Tabs defaultValue="mine">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mine">My Queue ({myQueue.length})</TabsTrigger>
            <TabsTrigger value="all">All Chairs</TabsTrigger>
            <TabsTrigger value="requests">Requests ({incoming.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="space-y-3 mt-4">
            {myQueue.length === 0 && <p className="text-center text-muted-foreground py-8">No customers in your queue.</p>}
            {myQueue.map((q) => (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold">#{q.queue_position} — {q.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{q.customer_phone}</p>
                      <p className="text-sm text-muted-foreground">{q.services?.name || 'No service'}</p>
                    </div>
                    <Badge>{q.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleServed(q.id)}>Mark served</Button>
                    {otherChairs.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => { const v = e.target.value; if (v) handleTransfer(q.id, v); e.target.value = ''; }}
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
                <h3 className="font-bold mb-2">Pending transfers you sent</h3>
                {outgoing.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-3 text-sm">Waiting for the other chair to accept…</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4 mt-4">
            {chairs.map((c) => (
              <Card key={c.id}>
                <CardHeader><CardTitle className="text-base">Chair #{c.chair_number}{c.name ? ` — ${c.name}` : ''}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(grouped[c.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Empty</p>
                  ) : (
                    (grouped[c.id] || []).map((q) => (
                      <div key={q.id} className="text-sm border border-border rounded p-2">
                        #{q.queue_position} · {q.customer_name} · <span className="text-muted-foreground">{q.services?.name || ''}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3 mt-4">
            {incoming.length === 0 && <p className="text-center text-muted-foreground py-8">No pending requests.</p>}
            {incoming.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm">Another barber wants to send a customer to your chair.</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespond(r.id, true)}>Accept</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRespond(r.id, false)}>Reject</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}