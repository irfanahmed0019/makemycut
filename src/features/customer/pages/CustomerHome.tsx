import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bookings } from '@/features/customer/components/Bookings';
import { TrustedPicks } from '@/features/customer/components/TrustedPicks';
import { Profile } from '@/features/customer/components/Profile';
import { ConfirmBooking } from '@/features/customer/components/ConfirmBooking';
import { BookingConfirmed } from '@/features/customer/components/BookingConfirmed';
import { BookingGateModal } from '@/features/customer/components/BookingGateModal';
import { JoinQueue } from '@/features/customer/components/JoinQueue';
import { QueueStatus } from '@/features/customer/components/QueueStatus';
import { SalonDetail } from '@/features/customer/components/SalonDetail';
import { AreaSearchBar } from '@/features/directory/components/AreaSearchBar';
import { consumePendingAction } from '@/features/directory/lib/pendingAction';
import { useSearchParams } from 'react-router-dom';

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
  const [queueData, setQueueData] = useState<{ queueId: string; position: number; estimatedWait: number } | null>(null);
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Handle directory → home handoff: pick up pending Book/Join Queue from sessionStorage
  useEffect(() => {
    const action = searchParams.get('action');
    if (action !== 'book' && action !== 'queue') return;
    const pending = consumePendingAction();
    setSearchParams({}, { replace: true });
    if (!pending) return;
    const salonForFlow = {
      id: pending.salon.id,
      name: pending.salon.name,
      description: '',
      image_url: pending.salon.image_url ?? '',
      rating: 0,
      review_count: 0,
      address: pending.salon.address ?? undefined,
    };
    if (pending.action === 'book') {
      handleBookNow(salonForFlow);
    } else {
      handleJoinQueue(salonForFlow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleBookNow = (barber: any) => {
    if (!user) {
      setPendingSection('confirm-booking');
      setSelectedBarber(barber);
      setShowAuthModal(true);
      return;
    }
    setSelectedBarber(barber);
    setActiveSection('confirm-booking');
  };

  const handleJoinQueue = (barber: any) => {
    if (!user) {
      setPendingSection('join-queue');
      setSelectedBarber(barber);
      setShowAuthModal(true);
      return;
    }
    setSelectedBarber(barber);
    setActiveSection('join-queue');
  };

  const handleViewSalon = (barber: any) => {
    setSelectedBarber(barber);
    setActiveSection('salon-detail');
  };

  const handleBack = () => {
    setActiveSection('home');
    setSelectedBarber(null);
    setQueueData(null);
  };

  const handleConfirm = (booking: any) => {
    setConfirmedBooking(booking);
    setActiveSection('booking-confirmed');
    setSelectedBarber(null);
    localStorage.setItem('booking_confirmed', 'true');
  };

  const handleConfirmedBack = () => { setActiveSection('home'); setConfirmedBooking(null); };

  const handleQueueJoined = (queueId: string, position: number, estimatedWait: number) => {
    setQueueData({ queueId, position, estimatedWait });
    setActiveSection('queue-status');
  };

  const handleOpenQueueStatus = (queue: { queueId: string; position: number; estimatedWait: number; salonId: string; salonName: string }) => {
    setSelectedBarber({ id: queue.salonId, name: queue.salonName });
    setQueueData({ queueId: queue.queueId, position: queue.position, estimatedWait: queue.estimatedWait });
    setActiveSection('queue-status');
  };

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

  const handleAuthClose = () => { setShowAuthModal(false); setPendingSection(null); };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="bg-background px-4 pt-8 pb-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Make My Cut</h1>
          <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: "'Playfair Display', serif" }}>Your Style, Your Time.</p>
        </div>
      </header>

      <main className="flex-grow px-4 pb-20 overflow-y-auto">
        {activeSection === 'bookings' && user && <Bookings onOpenQueueStatus={handleOpenQueueStatus} />}
        {activeSection === 'bookings' && !user && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">calendar_month</span>
            <p className="text-muted-foreground">Sign in to view your bookings</p>
          </div>
        )}
        {activeSection === 'home' && <TrustedPicks onBookNow={handleBookNow} onJoinQueue={handleJoinQueue} onViewSalon={handleViewSalon} />}
        {activeSection === 'profile' && user && <Profile />}
        {activeSection === 'profile' && !user && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">person</span>
            <p className="text-muted-foreground">Sign in to view your profile</p>
          </div>
        )}
        {activeSection === 'confirm-booking' && selectedBarber && (
          <ConfirmBooking barber={selectedBarber} onBack={handleBack} onConfirm={handleConfirm} />
        )}
        {activeSection === 'booking-confirmed' && confirmedBooking && (
          <BookingConfirmed booking={confirmedBooking} onBack={handleConfirmedBack} />
        )}
        {activeSection === 'salon-detail' && selectedBarber && (
          <SalonDetail
            salon={selectedBarber}
            onBookAppointment={() => { if (!user) { setPendingSection('confirm-booking'); setShowAuthModal(true); } else setActiveSection('confirm-booking'); }}
            onJoinQueue={() => { if (!user) { setPendingSection('join-queue'); setShowAuthModal(true); } else setActiveSection('join-queue'); }}
            onBack={handleBack}
          />
        )}
        {activeSection === 'join-queue' && selectedBarber && (
          <JoinQueue salon={selectedBarber} onJoined={handleQueueJoined} onBack={handleBack} />
        )}
        {activeSection === 'queue-status' && queueData && selectedBarber && (
          <QueueStatus
            queueId={queueData.queueId}
            salonName={selectedBarber.name}
            initialPosition={queueData.position}
            initialWait={queueData.estimatedWait}
            onBack={handleBack}
          />
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-card">
        <nav className="flex justify-around px-4 pt-2 pb-4">
          <button onClick={() => setActiveSection('home')} className={`flex flex-col items-center gap-1 ${activeSection === 'home' || activeSection === 'confirm-booking' || activeSection === 'salon-detail' || activeSection === 'join-queue' || activeSection === 'queue-status' ? 'text-foreground' : 'text-muted-foreground'}`}>
            <span className="material-symbols-outlined">home</span><span className="text-xs">Home</span>
          </button>
          <button onClick={() => handleProtectedSection('bookings')} className={`flex flex-col items-center gap-1 ${activeSection === 'bookings' ? 'text-foreground' : 'text-muted-foreground'}`}>
            <span className="material-symbols-outlined">calendar_month</span><span className="text-xs">Bookings</span>
          </button>
          <button onClick={() => handleProtectedSection('profile')} className={`flex flex-col items-center gap-1 ${activeSection === 'profile' ? 'text-foreground' : 'text-muted-foreground'}`}>
            <span className="material-symbols-outlined">person</span><span className="text-xs">Profile</span>
          </button>
        </nav>
      </footer>

      <BookingGateModal isOpen={showAuthModal} onClose={handleAuthClose} onSuccess={handleAuthSuccess} deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} />
    </div>
  );
};

export default CustomerHome;
