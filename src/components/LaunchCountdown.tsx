import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const LaunchCountdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date('2026-02-01T00:00:00').getTime();

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <section className="py-8 px-4">
      <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-background rounded-2xl p-6 text-center border border-primary/20">
        <h2 className="text-xl font-bold text-foreground mb-2">We Are Coming Live!</h2>
        <p className="text-muted-foreground text-sm mb-6">February 1, 2026</p>
        
        <div className="flex justify-center items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]">
              <span className="text-2xl font-bold text-primary">{formatNumber(timeLeft.days)}</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">Days</span>
          </div>
          
          <span className="text-2xl font-bold text-primary mb-4">:</span>
          
          <div className="flex flex-col items-center">
            <div className="bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]">
              <span className="text-2xl font-bold text-primary">{formatNumber(timeLeft.hours)}</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">Hrs</span>
          </div>
          
          <span className="text-2xl font-bold text-primary mb-4">:</span>
          
          <div className="flex flex-col items-center">
            <div className="bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]">
              <span className="text-2xl font-bold text-primary">{formatNumber(timeLeft.minutes)}</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">Min</span>
          </div>
          
          <span className="text-2xl font-bold text-primary mb-4">:</span>
          
          <div className="flex flex-col items-center">
            <div className="bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]">
              <span className="text-2xl font-bold text-primary">{formatNumber(timeLeft.seconds)}</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">Sec</span>
          </div>
        </div>
      </div>
    </section>
  );
};
