import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { QRScanner } from '@/components/salon/QRScanner';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  user_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  payment_method: string;
  qr_code: string | null;
  customer_name?: string;
  customer_phone?: string;
  services: {
    name: string;
    price: number;
  } | null;
}

interface Barber {
  id: string;
  name: string;
}

export default function SalonDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/salon-login');
    }
  }, [user, loading, navigate]);

  const fetchBookings = async (barberId: string) => {
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        booking_date,
        booking_time,
        status,
        payment_status,
        payment_method,
        qr_code,
        services:service_id(name, price)
      `)
      .eq('barber_id', barberId)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return [];
    }

    // Fetch profiles for each booking
    const bookingsWithProfiles = await Promise.all(
      (bookingsData || []).map(async (booking) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', booking.user_id)
          .maybeSingle();
        
        return {
          ...booking,
          customer_name: profile?.full_name || 'Unknown',
          customer_phone: profile?.phone || null,
        };
      })
    );

    return bookingsWithProfiles;
  };

  useEffect(() => {
    const fetchBarberAndBookings = async () => {
      if (!user) return;

      // Fetch barber shop owned by this user
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (barberError || !barberData) {
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: 'You are not registered as a salon owner.',
        });
        navigate('/salon-login');
        return;
      }

      setBarber(barberData);

      const bookingsWithProfiles = await fetchBookings(barberData.id);
      setAllBookings(bookingsWithProfiles);
      setIsLoading(false);
    };

    fetchBarberAndBookings();
  }, [user, navigate, toast]);

  // Real-time subscription for new bookings
  useEffect(() => {
    if (!barber) return;

    const channel = supabase
      .channel('salon-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `barber_id=eq.${barber.id}`,
        },
        async (payload) => {
          // Refetch all bookings when there's a change
          const updatedBookings = await fetchBookings(barber.id);
          setAllBookings(updatedBookings);
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New Booking!',
              description: 'A new appointment has been booked.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barber, toast]);

  // Filter bookings by selected date
  useEffect(() => {
    const filtered = allBookings.filter((booking) =>
      isSameDay(parseISO(booking.booking_date), selectedDate)
    );
    setBookings(filtered);
  }, [selectedDate, allBookings]);

  const handleQRScan = async (qrData: string) => {
    try {
      const bookingData = JSON.parse(qrData);
      const bookingId = bookingData.bookingId;

      // Find the booking
      const booking = allBookings.find((b) => b.id === bookingId);
      
      if (!booking) {
        toast({
          variant: 'destructive',
          title: 'Invalid QR Code',
          description: 'This booking was not found.',
        });
        return;
      }

      if (booking.status === 'completed') {
        toast({
          variant: 'destructive',
          title: 'Already Completed',
          description: 'This booking has already been marked as completed.',
        });
        return;
      }

      // Update booking status to completed
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (error) throw error;

      // Update local state
      setAllBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: 'completed' } : b
        )
      );

      toast({
        title: 'Check-in Successful!',
        description: `${booking.customer_name || 'Customer'} has been checked in.`,
      });
      setShowScanner(false);
    } catch (error) {
      console.error('QR scan error:', error);
      toast({
        variant: 'destructive',
        title: 'Scan Failed',
        description: 'Could not process this QR code.',
      });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/salon-login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get dates that have bookings for calendar highlighting
  const bookingDates = allBookings.map((b) => parseISO(b.booking_date));

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showScanner) {
    return (
      <QRScanner
        onScan={handleQRScan}
        onClose={() => setShowScanner(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{barber?.name}</h1>
            <p className="text-sm text-muted-foreground">Salon Dashboard</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* QR Scanner Button */}
        <Button
          onClick={() => setShowScanner(true)}
          className="w-full h-14 text-lg"
          size="lg"
        >
          <span className="material-symbols-outlined mr-2">qr_code_scanner</span>
          Scan Customer QR Code
        </Button>

        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className={cn("rounded-md border pointer-events-auto")}
              modifiers={{
                hasBooking: (date) => 
                  bookingDates.some(d => isSameDay(d, date)) && !isSameDay(date, selectedDate),
              }}
              modifiersClassNames={{
                hasBooking: 'font-bold text-primary underline underline-offset-2',
              }}
            />
          </CardContent>
        </Card>

        {/* Appointments for Selected Date */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Appointments - {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No appointments for this date
              </p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border border-border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {booking.booking_time.slice(0, 5)}
                      </span>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Customer:</span>{' '}
                        {booking.customer_name}
                      </p>
                      {booking.customer_phone && (
                        <p className="text-foreground">
                          <span className="text-muted-foreground">Phone:</span>{' '}
                          {booking.customer_phone}
                        </p>
                      )}
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Service:</span>{' '}
                        {booking.services?.name || 'Unknown'}
                      </p>
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Price:</span>{' '}
                        ₹{booking.services?.price || 0}
                      </p>
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Payment:</span>{' '}
                        {booking.payment_method === 'pay_now' ? 'Paid Online' : 'Pay at Salon'}
                        {' - '}
                        <span className={booking.payment_status === 'paid' ? 'text-green-500' : 'text-yellow-500'}>
                          {booking.payment_status}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
