import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, barbers(name), services(name, price)')
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })
      .limit(100);

    if (data) {
      // Fetch profiles
      const enriched = await Promise.all(data.map(async (b) => {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', b.user_id).maybeSingle();
        return { ...b, customer_name: profile?.full_name || 'Customer' };
      }));
      setBookings(enriched);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
    toast({ title: `Booking ${status}` });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading bookings...</div>;

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-lg font-bold">All Bookings ({bookings.length})</h3>
      {bookings.map(b => (
        <Card key={b.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{b.customer_name}</p>
                <p className="text-sm text-muted-foreground">{b.barbers?.name} · {b.services?.name}</p>
                <p className="text-sm text-muted-foreground">{b.booking_date} at {b.booking_time?.slice(0, 5)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={b.status === 'upcoming' ? 'default' : b.status === 'completed' ? 'secondary' : 'destructive'}>{b.status}</Badge>
                {b.status === 'upcoming' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(b.id, 'completed')}>Complete</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(b.id, 'cancelled')}>Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
