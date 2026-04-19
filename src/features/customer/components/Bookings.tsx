import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_method?: string;
  payment_status?: string;
  barbers: { name: string };
  services: { name: string; price: number };
}

interface ActiveQueue {
  id: string;
  queue_position: number;
  status: string;
  salon_id: string;
  salon_name: string;
  ahead: number;
  estimated_wait: number;
}

interface QueueListItem {
  position: number;
  name: string;
  isMe: boolean;
}

interface BookingsProps {
  onOpenQueueStatus?: (queue: { queueId: string; position: number; estimatedWait: number; salonId: string; salonName: string }) => void;
}

export const Bookings = ({ onOpenQueueStatus }: BookingsProps) => {
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [activeQueue, setActiveQueue] = useState<ActiveQueue | null>(null);
  const [queueList, setQueueList] = useState<QueueListItem[]>([]);
  const [showQueueList, setShowQueueList] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const maskName = (name: string) => {
    if (!name) return 'Customer';
    return name.trim().split(' ')[0] || 'Customer';
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchActiveQueue();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchActiveQueue, 30000);
    const onVis = () => { if (!document.hidden) fetchActiveQueue(); };
    document.addEventListener('visibilitychange', onVis);

    // Realtime: any change to queues for this user invalidates state
    const channel = supabase
      .channel(`bookings-queue-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `user_id=eq.${user.id}` }, () => fetchActiveQueue())
      .subscribe();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barbers (name),
        services (name, price)
      `)
      .eq('user_id', user.id)
      .order('booking_date', { ascending: true });

    if (!error && data) {
      const upcoming = data.filter((b) => b.status === 'upcoming' || b.status === 'CONFIRMED');
      const history = data.filter((b) => b.status !== 'upcoming' && b.status !== 'CONFIRMED');
      setUpcomingBookings(upcoming);
      setHistoryBookings(history);
    }
  };

  const fetchActiveQueue = async () => {
    if (!user) return;

    // Today's start (local) → ISO for filtering against joined_at
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const { data: activeQueues } = await supabase
      .from('queues')
      .select('id, queue_position, status, salon_id, joined_at')
      .eq('user_id', user.id)
      .in('status', ['waiting', 'serving'])
      .gte('joined_at', todayIso)
      .order('queue_position', { ascending: true })
      .order('joined_at', { ascending: true });

    if (!activeQueues?.length) {
      setActiveQueue(null);
      setQueueList([]);
      return;
    }

    const q = activeQueues[0];

    const [{ data: salon }, { count: aheadCount }, { data: settings }, { data: queueRows }] = await Promise.all([
      supabase.from('barbers').select('name').eq('id', q.salon_id).maybeSingle(),
      supabase.from('queues').select('id', { count: 'exact', head: true })
        .eq('salon_id', q.salon_id).in('status', ['waiting', 'serving']).gte('joined_at', todayIso).lt('queue_position', q.queue_position),
      supabase.from('salon_settings').select('wait_per_customer').eq('salon_id', q.salon_id).maybeSingle(),
      supabase.from('queues').select('id, queue_position, customer_name').eq('salon_id', q.salon_id).in('status', ['waiting', 'serving']).gte('joined_at', todayIso).order('queue_position', { ascending: true }),
    ]);

    const ahead = aheadCount || 0;
    const waitPer = settings?.wait_per_customer || 20;

    setQueueList((queueRows || []).map((row) => ({
      position: row.queue_position,
      name: maskName(row.customer_name),
      isMe: row.id === q.id,
    })));

    setActiveQueue({
      id: q.id,
      queue_position: q.queue_position,
      status: q.status,
      salon_id: q.salon_id,
      salon_name: salon?.name || 'Salon',
      ahead,
      estimated_wait: ahead * waitPer,
    });
  };

  const handleCancel = async (bookingId: string) => {
    if (!user) return;

    const { data, error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_user_id: user.id,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Could not cancel', description: error.message });
      return;
    }
    if (!data) {
      toast({ variant: 'destructive', title: 'Could not cancel', description: 'Booking is no longer cancellable.' });
      return;
    }
    toast({ title: 'Booking cancelled' });
    fetchBookings();
  };

  const handleLeaveQueue = async () => {
    if (!user || !activeQueue) return;

    const { error } = await supabase.rpc('leave_queue', {
      p_queue_id: activeQueue.id,
      p_user_id: user.id,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Could not leave', description: error.message });
      return;
    }

    toast({ title: 'You left the queue' });
    setActiveQueue(null);
    setQueueList([]);
    setShowQueueList(false);
    fetchActiveQueue();
  };

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold mb-4 text-center font-display">My Bookings</h2>
      <div className="space-y-8">
        {activeQueue && (
          <div className="premium-card p-5 ring-1 ring-primary/40 red-glow">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">In Queue</p>
                <h3 className="text-lg font-bold font-display">{activeQueue.salon_name}</h3>
              </div>
              <span className="material-symbols-outlined text-primary text-3xl animate-pulse">groups</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-secondary/40 border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="text-2xl font-bold text-primary">#{activeQueue.queue_position}</p>
              </div>
              <div className="bg-secondary/40 border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Ahead</p>
                <p className="text-2xl font-bold">{activeQueue.ahead}</p>
              </div>
              <div className="bg-secondary/40 border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Wait</p>
                <p className="text-2xl font-bold">{activeQueue.estimated_wait}<span className="text-xs font-normal">m</span></p>
              </div>
            </div>
            <div className={onOpenQueueStatus ? 'grid grid-cols-2 gap-3 mb-3' : 'mb-3'}>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowQueueList(true)}>
                <span className="material-symbols-outlined mr-2 text-base">groups</span>
                View Queue
              </Button>
              {onOpenQueueStatus && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => onOpenQueueStatus({
                    queueId: activeQueue.id,
                    position: activeQueue.queue_position,
                    estimatedWait: activeQueue.estimated_wait,
                    salonId: activeQueue.salon_id,
                    salonName: activeQueue.salon_name,
                  })}
                >
                  <span className="material-symbols-outlined mr-2 text-base">visibility</span>
                  Open Status
                </Button>
              )}
            </div>
            <Button variant="destructive" size="sm" className="w-full" onClick={handleLeaveQueue}>
              <span className="material-symbols-outlined mr-2 text-base">logout</span>
              Leave Queue
            </Button>
          </div>
        )}

        <div>
          <h3 className="text-xl font-bold mb-4">Upcoming Bookings</h3>
          {upcomingBookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No upcoming bookings</p>
          ) : (
            upcomingBookings.map((booking, index) => (
              <div key={booking.id} className={`premium-card overflow-hidden mb-4 ${
                index === 0 ? 'ring-1 ring-primary/50' : ''
              }`}>
                {index === 0 && (
                  <div className="bg-primary text-primary-foreground px-4 py-1 text-xs font-medium text-center">
                    Latest Booking
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-card-foreground">{booking.barbers?.name}</h4>
                      <p className="text-muted-foreground">{booking.services?.name}</p>
                      <p className="text-foreground mt-1">₹{booking.services?.price}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        booking.payment_status === 'paid'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {booking.payment_status === 'paid' ? 'Paid' : 'Pay at Salon'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4 border-t border-border">
                  <div className="flex items-center text-foreground mt-2">
                    <span className="material-symbols-outlined mr-2 text-lg">calendar_today</span>
                    <span>{format(new Date(booking.booking_date), 'MMM dd, yyyy')}</span>
                    <span className="mx-2">·</span>
                    <span className="material-symbols-outlined mr-2 text-lg">schedule</span>
                    <span>{booking.booking_time}</span>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => handleCancel(booking.id)}
                      variant="secondary"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button variant="default" className="flex-1">
                      Reschedule
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {historyBookings.length > 0 && (
          <div>
            <h3 className="text-xl font-bold mb-4">History</h3>
            <div className="space-y-2">
              {historyBookings.map((booking) => (
                <div key={booking.id} className="bg-card/40 border border-border p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-card-foreground">{booking.barbers?.name}</h4>
                    <p className="text-sm text-muted-foreground">{booking.services?.name}</p>
                  </div>
                  <span className={`font-medium capitalize ${
                    booking.status === 'completed' ? 'text-green-400' :
                    booking.status === 'cancelled' ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showQueueList} onOpenChange={setShowQueueList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Current Queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
            {queueList.length === 0 && <p className="text-muted-foreground text-center py-4">No one in queue</p>}
            {queueList.map((person) => (
              <div key={person.position} className={`flex items-center gap-3 p-3 rounded-lg border ${person.isMe ? 'bg-primary/10 border-primary' : 'bg-secondary/40 border-border'}`}>
                <span className="font-bold text-primary w-8">{person.position}.</span>
                <span className="flex-1">{person.name}</span>
                {person.isMe && <span className="text-xs text-primary font-semibold uppercase">You</span>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
