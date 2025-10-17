import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface BookingQRCodeProps {
  booking: {
    id: string;
    booking_date: string;
    booking_time: string;
    barbers: { name: string };
    services: { name: string; price: number };
    payment_method?: string;
    payment_status?: string;
  };
  onBack?: () => void;
}

export const BookingQRCode = ({ booking, onBack }: BookingQRCodeProps) => {
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full mb-4">
            <span className="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground">Show this QR code at the salon</p>
        </div>

        <div className="bg-white p-6 rounded-xl flex items-center justify-center">
          <QRCodeSVG 
            value={booking.id}
            size={200}
            level="H"
            includeMargin
          />
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Salon</p>
              <p className="font-semibold text-foreground">{booking.barbers.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Service</p>
              <p className="font-semibold text-foreground">{booking.services.name}</p>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <span className="material-symbols-outlined text-lg">calendar_today</span>
              <span>{format(new Date(booking.booking_date), 'MMM dd, yyyy')}</span>
              <span>·</span>
              <span className="material-symbols-outlined text-lg">schedule</span>
              <span>{booking.booking_time}</span>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-foreground">₹{booking.services.price}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium text-foreground capitalize">
                {booking.payment_method?.replace('_', ' ') || 'Pay at Salon'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${
                booking.payment_status === 'paid' ? 'text-green-500' : 'text-amber-500'
              }`}>
                {booking.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Booking ID: {booking.id.slice(0, 8)}
          </p>
        </div>

        {onBack && (
          <Button onClick={onBack} variant="outline" className="w-full">
            Back to Home
          </Button>
        )}
      </Card>
    </div>
  );
};
