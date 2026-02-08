import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bookings } from '@/features/customer/components/Bookings';
import { TrustedPicks } from '@/features/customer/components/TrustedPicks';
import { Profile } from '@/features/customer/components/Profile';
import { ConfirmBooking } from '@/features/customer/components/ConfirmBooking';
import { BookingConfirmed } from '@/features/customer/components/BookingConfirmed';
import { BookingGateModal } from '@/features/customer/components/BookingGateModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CustomerHome = () => {
  const [activeSection, setActiveSection] = useState<string>('home');
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { user, loading } = useAuth();

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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
    setActiveSection('booking-confirmed');
    setSelectedBarber(null);
    localStorage.setItem('booking_confirmed', 'true');
  };

  const handleConfirmedBack = () => {
    setActiveSection('home');
    setConfirmedBooking(null);
  };

  // Handle sections that require auth - show modal instead of redirect
  const handleProtectedSection = (section: string) => {
    if (!user && (section === 'bookings' || section === 'profile')) {
      setPendingSection(section);
      setShowAuthModal(true);
      return;
    }
    setActiveSection(section);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (pendingSection) {
      setActiveSection(pendingSection);
      setPendingSection(null);
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    setPendingSection(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="bg-background px-4 pt-8 pb-4">
        <div className="text-center">
          <h1
            className="text-4xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Make My Cut
          </h1>
          <p
            className="text-sm text-muted-foreground mt-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Your Style, Your Time.
          </p>
        </div>
      </header>

      <main className="flex-grow px-4 pb-20 overflow-y-auto">
        {activeSection === 'bookings' && user && <Bookings />}
        {activeSection === 'bookings' && !user && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">
              calendar_month
            </span>
            <p className="text-muted-foreground">Sign in to view your bookings</p>
          </div>
        )}
        {activeSection === 'home' && <TrustedPicks onBookNow={handleBookNow} />}
        {activeSection === 'profile' && user && <Profile />}
        {activeSection === 'profile' && !user && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">
              person
            </span>
            <p className="text-muted-foreground">Sign in to view your profile</p>
          </div>
        )}
        {activeSection === 'confirm-booking' && selectedBarber && (
          <ConfirmBooking
            barber={selectedBarber}
            onBack={handleBack}
            onConfirm={handleConfirm}
          />
        )}
        {activeSection === 'booking-confirmed' && confirmedBooking && (
          <BookingConfirmed booking={confirmedBooking} onBack={handleConfirmedBack} />
        )}
      </main>

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
            onClick={() => handleProtectedSection('bookings')}
            className={`flex flex-col items-center gap-1 ${
              activeSection === 'bookings' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="text-xs">Bookings</span>
          </button>
          <button
            onClick={() => handleProtectedSection('profile')}
            className={`flex flex-col items-center gap-1 ${
              activeSection === 'profile' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-xs">Profile</span>
          </button>
        </nav>
      </footer>

      <BookingGateModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
        deferredPrompt={deferredPrompt}
        setDeferredPrompt={setDeferredPrompt}
      />
    </div>
  );
};

export default CustomerHome;
