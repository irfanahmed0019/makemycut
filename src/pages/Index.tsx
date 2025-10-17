import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bookings } from '@/components/Bookings';
import { TrustedPicks } from '@/components/TrustedPicks';
import { Profile } from '@/components/Profile';
import { ConfirmBooking } from '@/components/ConfirmBooking';
import { BookingQRCode } from '@/components/BookingQRCode';

const Index = () => {
  const [activeSection, setActiveSection] = useState<string>('home');
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleBookNow = (barber: any) => {
    setSelectedBarber(barber);
    setActiveSection('confirm-booking');
  };

  const handleBack = () => {
    setActiveSection('home');
    setSelectedBarber(null);
  };

  const handleConfirm = (booking: any) => {
    setConfirmedBooking(booking);
    setActiveSection('qr-code');
    setSelectedBarber(null);
  };

  const handleQRBack = () => {
    setActiveSection('home');
    setConfirmedBooking(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-background px-4 pt-8 pb-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Make My Cut
          </h1>
          <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your Style, Your Time.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow px-4 pb-20 overflow-y-auto">
        {activeSection === 'bookings' && <Bookings />}
        {activeSection === 'home' && <TrustedPicks onBookNow={handleBookNow} />}
        {activeSection === 'profile' && <Profile />}
        {activeSection === 'confirm-booking' && selectedBarber && (
          <ConfirmBooking barber={selectedBarber} onBack={handleBack} onConfirm={handleConfirm} />
        )}
        {activeSection === 'qr-code' && confirmedBooking && (
          <BookingQRCode booking={confirmedBooking} onBack={handleQRBack} />
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="sticky bottom-0 border-t border-border bg-card">
        <nav className="flex justify-around px-4 pt-2 pb-4">
          <button
            onClick={() => setActiveSection('home')}
            className={`flex flex-col items-center gap-1 ${
              activeSection === 'home' || activeSection === 'confirm-booking'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <span className="material-symbols-outlined">home</span>
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveSection('bookings')}
            className={`flex flex-col items-center gap-1 ${
              activeSection === 'bookings' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="text-xs">Bookings</span>
          </button>
          <button
            onClick={() => setActiveSection('profile')}
            className={`flex flex-col items-center gap-1 ${
              activeSection === 'profile' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-xs">Profile</span>
          </button>
        </nav>
      </footer>
    </div>
  );
};

export default Index;
