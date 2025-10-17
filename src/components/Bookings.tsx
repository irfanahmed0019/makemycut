import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

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

export const Bookings = () => {
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
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
      const upcoming = data.filter((b) => b.status === 'upcoming');
      const history = data.filter((b) => b.status !== 'upcoming');
      setUpcomingBookings(upcoming);
      setHistoryBookings(history);
    }
  };

  const handleCancel = async (bookingId: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    
    if (!error) {
      fetchBookings();
    }
  };

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold mb-4 text-center">My Bookings</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-4">Upcoming Bookings</h3>
          {upcomingBookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No upcoming bookings</p>
          ) : (
            upcomingBookings.map((booking, index) => (
              <div key={booking.id} className={`bg-card rounded-xl shadow-lg overflow-hidden mb-4 ${
                index === 0 ? 'ring-2 ring-primary' : ''
              }`}>
                {index === 0 && (
                  <div className="bg-primary text-primary-foreground px-4 py-1 text-xs font-medium text-center">
                    Latest Booking
                  </div>
                )}
                <div className="p-4 flex gap-4">
                  <button 
                    onClick={() => setSelectedBooking(booking)}
                    className="w-24 h-24 flex items-center justify-center bg-white rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <QRCodeSVG value={booking.id} size={80} />
                  </button>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-card-foreground">{booking.barbers.name}</h4>
                    <p className="text-muted-foreground">{booking.services.name}</p>
                    <p className="text-foreground mt-1">₹{booking.services.price}</p>
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
                <div key={booking.id} className="bg-card/10 p-4 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-card-foreground">{booking.barbers.name}</h4>
                    <p className="text-sm text-muted-foreground">{booking.services.name}</p>
                  </div>
                  <span className={`font-medium ${
                    booking.status === 'completed' ? 'text-green-400' :
                    booking.status === 'cancelled' ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {booking.status === 'completed' ? 'Done' :
                     booking.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Booking QR Code</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-lg flex items-center justify-center">
                <QRCodeSVG value={selectedBooking.id} size={200} level="H" includeMargin />
              </div>
              <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Salon</p>
                  <p className="font-semibold">{selectedBooking.barbers.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-semibold">{selectedBooking.services.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">calendar_today</span>
                  <span>{format(new Date(selectedBooking.booking_date), 'MMM dd, yyyy')}</span>
                  <span>·</span>
                  <span className="material-symbols-outlined text-lg">schedule</span>
                  <span>{selectedBooking.booking_time}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-semibold">₹{selectedBooking.services.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Payment</span>
                    <span className="text-sm capitalize">{selectedBooking.payment_method?.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
