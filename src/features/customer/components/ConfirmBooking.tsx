import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BookingGateModal } from './BookingGateModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

const timeSlots = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', 
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'
];

// Convert 24h DB time (e.g. "17:00:00") to 12h display (e.g. "5:00 PM")
const to12h = (t: string): string => {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${suffix}`;
};

// Convert 12h display (e.g. "5:00 PM") to 24h (e.g. "17:00")
const to24h = (t: string): string => {
  const [timePart, period] = t.split(' ');
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${mStr}`;
};

export const ConfirmBooking = ({ barber, onBack, onConfirm }: ConfirmBookingProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('10:00 AM');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showGateModal, setShowGateModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());

  // Capture install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [barber]);

  // Fetch slot states periodically
  useEffect(() => {
    fetchSlotStates();
    const interval = setInterval(fetchSlotStates, 10000);
    return () => clearInterval(interval);
  }, [selectedDate, barber]);

  const handleSlotSelect = (time: string) => {
    setSelectedTime(time);
  };

  const fetchSlotStates = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data: slotsData } = await supabase
      .from('bookings')
      .select('booking_time')
      .eq('barber_id', barber.id)
      .eq('booking_date', dateStr)
      .eq('status', 'CONFIRMED');

    const booked = new Set<string>();
    if (slotsData) {
      slotsData.forEach((b) => {
        booked.add(to12h(b.booking_time));
      });
    }
    setBookedSlots(booked);

    if (booked.has(selectedTime)) {
      const available = timeSlots.find((t) => !booked.has(t));
      if (available) setSelectedTime(available);
    }
  };

  // Default services if none exist in database
  const defaultServices: Service[] = [
    { id: 'default-haircut', name: 'Haircut', description: 'Classic haircut', price: 200, duration_minutes: 30 },
    { id: 'default-shave', name: 'Shave', description: 'Clean shave', price: 100, duration_minutes: 20 },
    { id: 'default-beard-trim', name: 'Beard Trim', description: 'Beard trimming and styling', price: 280, duration_minutes: 25 },
  ];

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', barber.id);

    if (!error && data && data.length > 0) {
      setServices(data);
      setSelectedService(data[0].id);
    } else {
      setServices(defaultServices);
      setSelectedService(defaultServices[0].id);
    }
  };

  const handleConfirmClick = () => {
    if (!user) {
      setShowGateModal(true);
      return;
    }
    processBooking();
  };

  const processBooking = async () => {
    if (!user) return;

    if (!selectedService) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a service' });
      return;
    }

    const today = startOfDay(new Date());
    const selectedDateStart = startOfDay(selectedDate);
    if (isBefore(selectedDateStart, today)) {
      toast({ variant: 'destructive', title: 'Invalid Date', description: 'Cannot book appointments in the past.' });
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const time24 = to24h(selectedTime);

    // Atomic: booking limit check + insert in one RPC
    const { data, error } = await supabase.rpc('place_hold', {
      p_barber_id: barber.id,
      p_booking_date: dateStr,
      p_booking_time: time24,
      p_user_id: user.id,
      p_service_id: selectedService,
    });

    // Always refresh slot states
    await fetchSlotStates();

    if (error) {
      const msg = error.message || '';
      if (msg.includes('BOOKING_LIMIT')) {
        toast({ variant: 'destructive', title: 'Booking Limit Reached', description: 'Maximum 2 active bookings allowed.' });
      } else {
        toast({ variant: 'destructive', title: 'Slot Unavailable', description: 'Sorry, this time slot has already been booked.' });
      }
      return;
    }

    // Fetch confirmed booking details
    const { data: bookingData } = await supabase
      .from('bookings')
      .select(`*, barbers (name), services (name, price)`)
      .eq('id', data)
      .single();

    if (bookingData) {
      onConfirm(bookingData);
    }
  };

  const handleGateSuccess = () => {
    setShowGateModal(false);
    processBooking();
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
            {barber.address && (
              <p className="text-sm text-muted-foreground">
                Location: {barber.address}
              </p>
            )}
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
            {daysInMonth.map((day) => {
              const today = startOfDay(new Date());
              const dayStart = startOfDay(day);
              const isPast = isBefore(dayStart, today);
              
              return (
                <Button
                  key={day.toISOString()}
                  variant={isSameDay(day, selectedDate) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedDate(day)}
                  disabled={isPast}
                  className="h-10 rounded-full"
                >
                  {format(day, 'd')}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold px-4 pb-3 pt-6">
        Select Time <span className="text-sm font-normal text-muted-foreground">(15 min buffer)</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 px-4">
        {timeSlots.map((time) => {
          const isBooked = bookedSlots.has(time);
          const isSelected = selectedTime === time && !isBooked;

          let variant: 'default' | 'outline' | 'ghost' | 'secondary' = 'outline';
          let extraClass = 'flex flex-col items-center justify-center gap-0.5';

          if (isSelected) {
            variant = 'default';
          } else if (isBooked) {
            extraClass += ' opacity-40 bg-muted text-muted-foreground';
          }

          return (
            <Button
              key={time}
              variant={variant}
              onClick={() => handleSlotSelect(time)}
              disabled={isBooked}
              className={extraClass}
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">schedule</span>
                <span>{time}</span>
              </span>
              {isBooked && <span className="text-[10px] text-muted-foreground font-normal">Booked</span>}
            </Button>
          );
        })}
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

      <div className="px-4 py-3">
        <Button onClick={handleConfirmClick} className="w-full h-14 text-lg font-bold">
          Confirm Booking
        </Button>
      </div>

      {/* Booking Gate Modal */}
      <BookingGateModal
        isOpen={showGateModal}
        onClose={() => setShowGateModal(false)}
        onSuccess={handleGateSuccess}
        deferredPrompt={deferredPrompt}
        setDeferredPrompt={setDeferredPrompt}
      />
    </section>
  );
};
