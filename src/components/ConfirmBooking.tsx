import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface ConfirmBookingProps {
  barber: any;
  onBack: () => void;
  onConfirm: (booking: any) => void;
}

const timeSlots = ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM'];

export const ConfirmBooking = ({ barber, onBack, onConfirm }: ConfirmBookingProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('10:00 AM');
  const [paymentMethod, setPaymentMethod] = useState<string>('pay_now');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchServices();
  }, [barber]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id);

    if (!error && data) {
      setServices(data);
      if (data.length > 0) {
        setSelectedService(data[0].id);
      }
    }
  };

  const handleConfirm = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Authenticated',
        description: 'Please sign in to book an appointment',
      });
      return;
    }

    if (!selectedService) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a service',
      });
      return;
    }

    const service = services.find((s) => s.id === selectedService);
    if (!service) return;

    const { data, error } = await supabase.from('bookings').insert({
      user_id: user.id,
      barber_id: barber.id,
      service_id: selectedService,
      booking_date: format(selectedDate, 'yyyy-MM-dd'),
      booking_time: selectedTime,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'pay_now' ? 'paid' : 'pending',
      status: 'upcoming',
    }).select();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Booking failed',
        description: error.message,
      });
    } else if (data && data[0]) {
      // Fetch the complete booking with barber and service details
      const { data: bookingData } = await supabase
        .from('bookings')
        .select(`
          *,
          barbers (name),
          services (name, price)
        `)
        .eq('id', data[0].id)
        .single();

      if (bookingData) {
        onConfirm(bookingData);
      }
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const selectedServiceData = services.find((s) => s.id === selectedService);

  return (
    <section className="pt-4">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <Button
          onClick={onBack}
          size="icon"
          variant="secondary"
          className="rounded-full"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center">Confirm Your Booking</h1>
        <div className="w-10"></div>
      </header>

      <p className="text-muted-foreground text-sm px-4 pb-4 pt-1">
        Please review your booking details and confirm.
      </p>

      <div className="px-4 pb-6">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">Saloon</p>
            <p className="text-lg font-bold">{barber.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined text-base text-primary">star</span>
              <span>{barber.rating}</span>
              <span>|</span>
              <span>{barber.review_count} reviews</span>
            </div>
          </div>
          <img
            src={barber.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'}
            className="w-20 h-20 object-cover rounded-lg"
            alt={barber.name}
          />
        </div>
      </div>

      <h2 className="text-lg font-bold px-4 pb-3">Select Service</h2>
      <div className="flex flex-col gap-3 px-4">
        {services.map((service) => (
          <label key={service.id} className="flex items-center gap-4 cursor-pointer">
            <input
              type="radio"
              name="service"
              value={service.id}
              checked={selectedService === service.id}
              onChange={(e) => setSelectedService(e.target.value)}
              className="h-5 w-5 text-primary"
            />
            <div className="flex grow flex-col rounded-lg border border-border p-3">
              <p className="text-base font-medium">{service.name}</p>
              <p className="text-sm text-muted-foreground">
                ₹{service.price} · {service.duration_minutes} min
              </p>
            </div>
          </label>
        ))}
      </div>

      <h2 className="text-lg font-bold px-4 pb-3 pt-6">Select Date</h2>
      <div className="px-4">
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center justify-between pb-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </Button>
            <p className="text-base font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
              <p key={day} className="text-sm font-bold text-muted-foreground h-10 flex items-center justify-center">
                {day}
              </p>
            ))}
            {daysInMonth.map((day) => (
              <Button
                key={day.toISOString()}
                variant={isSameDay(day, selectedDate) ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedDate(day)}
                className="h-10 rounded-full"
              >
                {format(day, 'd')}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold px-4 pb-3 pt-6">Select Time</h2>
      <div className="grid grid-cols-2 gap-3 px-4">
        {timeSlots.map((time) => (
          <Button
            key={time}
            variant={selectedTime === time ? 'default' : 'outline'}
            onClick={() => setSelectedTime(time)}
            className="flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">schedule</span>
            <span>{time}</span>
          </Button>
        ))}
      </div>

      <h2 className="text-lg font-bold px-4 pb-3 pt-6">Booking Summary</h2>
      <div className="px-4">
        <div className="p-4 bg-card rounded-xl space-y-4">
          <div className="flex justify-between">
            <p className="text-muted-foreground text-sm">Service</p>
            <p className="text-sm font-medium">{selectedServiceData?.name}</p>
          </div>
          <div className="w-full h-[1px] bg-border"></div>
          <div className="flex justify-between">
            <p className="text-muted-foreground text-sm">Date</p>
            <p className="text-sm font-medium">{format(selectedDate, 'MMMM dd, yyyy')}</p>
          </div>
          <div className="w-full h-[1px] bg-border"></div>
          <div className="flex justify-between">
            <p className="text-muted-foreground text-sm">Time</p>
            <p className="text-sm font-medium">{selectedTime}</p>
          </div>
          <div className="w-full h-[1px] bg-border"></div>
          <div className="flex justify-between">
            <p className="text-muted-foreground text-sm">Price</p>
            <p className="text-sm font-bold">₹{selectedServiceData?.price}</p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold px-4 pb-3 pt-6">Payment Options</h2>
      <div className="flex flex-col gap-3 px-4 pb-6">
        <label className="flex items-center gap-4 cursor-pointer">
          <input
            type="radio"
            name="payment"
            value="pay_now"
            checked={paymentMethod === 'pay_now'}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-5 w-5"
          />
          <div className="flex grow items-center rounded-lg border border-border p-3">
            <p className="text-base font-medium">Pay Now (UPI/Online)</p>
          </div>
        </label>
        <label className="flex items-center gap-4 cursor-pointer">
          <input
            type="radio"
            name="payment"
            value="pay_at_salon"
            checked={paymentMethod === 'pay_at_salon'}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="h-5 w-5"
          />
          <div className="flex grow items-center rounded-lg border border-border p-3">
            <p className="text-base font-medium">Pay at Saloon</p>
          </div>
        </label>
      </div>

      <div className="px-4 py-3">
        <Button onClick={handleConfirm} className="w-full h-14 text-lg font-bold">
          Confirm Booking
        </Button>
      </div>
    </section>
  );
};
