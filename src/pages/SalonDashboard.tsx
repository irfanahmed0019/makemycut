import { useState, useEffect, useRef } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay, isToday } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { QRScanner } from '@/components/salon/QRScanner';
import { DashboardAnalytics } from '@/components/salon/DashboardAnalytics';
import { OwnerQueueTab } from '@/features/salon/components/OwnerQueueTab';
import { OwnerSettingsTab } from '@/features/salon/components/OwnerSettingsTab';
import { SalonQRCodes } from '@/features/salon/components/SalonQRCodes';
import { cn } from '@/lib/utils';
import { z } from 'zod';

// QR payloads come from an untrusted source (any printed/forged code), so the
// decoded text is size-capped and schema-validated before it is used.
const QR_MAX_LENGTH = 1000;
const QRBookingSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
});

interface Booking {
  id: string;
  user_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  customer_name?: string;
  customer_phone?: string;
  services: { name: string; price: number } | null;
}

interface Barber {
  id: string;
  name: string;
}

const CACHE_KEY = 'mmc_salon_dashboard_cache_v1';

const readCache = (): { barber: Barber; bookings: Booking[] } | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

// Only load a useful window of bookings instead of the salon's entire history.
const windowStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return d.toISOString().slice(0, 10);
};

export default function SalonDashboard() {
  const cached = readCache();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>(cached?.bookings ?? []);
  const [barber, setBarber] = useState<Barber | null>(cached?.barber ?? null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState('appointments');
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/salon-login');
  }, [user, loading, navigate]);

  const fetchBookings = async (barberId: string) => {
    const { data: bookingsData, error } = await supabase
      .from('bookings')
      .select('id, user_id, booking_date, booking_time, status, payment_status, services:service_id(name, price)')
      .eq('barber_id', barberId)
      .gte('booking_date', windowStart())
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
    if (error) return [];
    const rows = bookingsData || [];
    // One batched profile lookup instead of a query per booking.
    const userIds = Array.from(new Set(rows.map((b) => b.user_id).filter(Boolean)));
    const profileMap: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
      (profs || []).forEach((p) => { profileMap[p.id] = { full_name: p.full_name, phone: p.phone }; });
    }
    return rows.map((booking) => ({
      ...booking,
      customer_name: profileMap[booking.user_id]?.full_name || 'Customer',
      customer_phone: profileMap[booking.user_id]?.phone || undefined,
    }));
  };

  useEffect(() => {
    const fetchBarberAndBookings = async () => {
      if (!user) return;
      const { data: barberData, error } = await supabase.from('barbers').select('id, name').eq('owner_id', user.id).maybeSingle();
      if (error || !barberData) {
        sessionStorage.removeItem(CACHE_KEY);
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not registered as a salon owner.' });
        navigate('/salon-login');
        return;
      }
      setBarber(barberData);
      const bookingsWithProfiles = await fetchBookings(barberData.id);
      setAllBookings(bookingsWithProfiles);
      setIsLoading(false);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ barber: barberData, bookings: bookingsWithProfiles }));
      } catch { /* ignore quota */ }
    };
    fetchBarberAndBookings();
  }, [user, navigate, toast]);

  useEffect(() => {
    if (!barber) return;
    // Realtime bursts (several rows changing at once) collapse into one refetch.
    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(async () => {
        const updated = await fetchBookings(barber.id);
        setAllBookings(updated);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ barber, bookings: updated }));
        } catch { /* ignore quota */ }
      }, 400);
    };
    const channel = supabase
      .channel('salon-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${barber.id}` }, (payload) => {
        scheduleRefresh();
        if (payload.eventType === 'INSERT') toast({ title: 'New Booking!', description: 'A new appointment has been booked.' });
      })
      .subscribe();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [barber, toast]);

  useEffect(() => {
    setBookings(allBookings.filter((b) => isSameDay(parseISO(b.booking_date), selectedDate)));
  }, [selectedDate, allBookings]);

  const todaysEarnings = allBookings
    .filter((b) => isToday(parseISO(b.booking_date)) && b.status === 'completed')
    .reduce((sum, b) => sum + (b.services?.price || 0), 0);

  const handleQRScan = async (qrData: string) => {
    if (typeof qrData !== 'string' || qrData.length > QR_MAX_LENGTH) {
      toast({ variant: 'destructive', title: 'Invalid QR Code', description: 'QR code data is too large.' });
      return;
    }

    let bookingData: z.infer<typeof QRBookingSchema>;
    try {
      bookingData = QRBookingSchema.parse(JSON.parse(qrData));
    } catch {
      toast({ variant: 'destructive', title: 'Invalid QR Code', description: 'This QR code format is not recognized.' });
      return;
    }

    try {
      const booking = allBookings.find((b) => b.id === bookingData.bookingId && b.user_id === bookingData.userId);
      if (!booking) { toast({ variant: 'destructive', title: 'Invalid QR Code' }); return; }
      if (booking.status === 'completed') { toast({ variant: 'destructive', title: 'Already Completed' }); return; }
      const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingData.bookingId);
      if (error) throw error;
      setAllBookings((prev) => prev.map((b) => b.id === bookingData.bookingId ? { ...b, status: 'completed' } : b));
      toast({ title: 'Check-in Successful!', description: `${booking.customer_name} has been checked in.` });
      setShowScanner(false);
    } catch { toast({ variant: 'destructive', title: 'Scan Failed' }); }
  };

  const handleMarkCompleted = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: 'Could not update.' }); return; }
    setAllBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'completed' } : b));
    toast({ title: 'Booking Completed' });
  };

  const handleCancelBooking = async (bookingId: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
    if (error) { toast({ variant: 'destructive', title: 'Error' }); return; }
    setAllBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
    toast({ title: 'Booking Cancelled' });
  };

  const getStatusColor = (status: string) => {
    switch (status) { case 'upcoming': return 'bg-yellow-500'; case 'completed': return 'bg-green-500'; case 'cancelled': return 'bg-red-500'; default: return 'bg-gray-500'; }
  };
  const getStatusLabel = (status: string) => {
    switch (status) { case 'upcoming': return 'Pending'; case 'completed': return 'Completed'; case 'cancelled': return 'Cancelled'; default: return status; }
  };

  const bookingDates = allBookings.map((b) => parseISO(b.booking_date));

  if (loading || isLoading) {
    return <PageSkeleton />;
  }

  if (showScanner) return <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-foreground">{barber?.name}</h1><p className="text-sm text-muted-foreground">Salon Dashboard</p></div>
          <Button variant="outline" onClick={async () => { await signOut(); navigate('/salon-login'); }}>Logout</Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Button onClick={() => setShowScanner(true)} className="w-full h-14 text-lg" size="lg">
          <span className="material-symbols-outlined mr-2">qr_code_scanner</span>Scan Customer QR Code
        </Button>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="appointments">Bookings</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="qrcodes">QR Codes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4"><DashboardAnalytics bookings={allBookings} /></TabsContent>

          <TabsContent value="appointments" className="mt-4 space-y-4">
            <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-300">Today's Earnings</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-400">₹{todaysEarnings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{allBookings.filter((b) => isToday(parseISO(b.booking_date)) && b.status === 'completed').length} completed today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Select Date</CardTitle></CardHeader>
              <CardContent>
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} className={cn("rounded-md border pointer-events-auto")}
                  components={{
                    DayContent: ({ date }) => {
                      const hasBooking = bookingDates.some(d => isSameDay(d, date));
                      return (<div className="relative w-full h-full flex items-center justify-center">{date.getDate()}{hasBooking && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500" />}</div>);
                    },
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Appointments - {format(selectedDate, 'MMMM d, yyyy')}</CardTitle></CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No appointments for this date</p>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{booking.booking_time.slice(0, 5)}</span>
                          <Badge className={getStatusColor(booking.status)}>{getStatusLabel(booking.status)}</Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Customer:</span> {booking.customer_name}</p>
                          <p><span className="text-muted-foreground">Service:</span> {booking.services?.name || 'N/A'}</p>
                          <p><span className="text-muted-foreground">Price:</span> ₹{booking.services?.price || 0}</p>
                        </div>
                        {booking.status === 'upcoming' && (
                          <div className="flex gap-2 mt-2">
                            <Button variant="default" size="sm" className="flex-1" onClick={() => handleMarkCompleted(booking.id)}>Mark as Completed</Button>
                            <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleCancelBooking(booking.id)}>Cancel</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            {barber && <OwnerQueueTab barberId={barber.id} />}
          </TabsContent>

          <TabsContent value="qrcodes" className="mt-4">
            {barber && <SalonQRCodes salonId={barber.id} salonName={barber.name} />}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {barber && <OwnerSettingsTab barberId={barber.id} barberName={barber.name} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
