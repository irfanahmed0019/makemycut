import { useState, useEffect, useRef } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const FlipCard = ({ value, label }: { value: string; label: string }) => {
  const [flip, setFlip] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setFlip(true);
      const timer = setTimeout(() => setFlip(false), 300);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div 
        className={`
          bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]
          transition-all duration-300 ease-out
          ${flip ? 'scale-110 shadow-lg shadow-primary/30' : 'scale-100'}
        `}
        style={{
          transform: flip ? 'rotateX(-10deg)' : 'rotateX(0deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        <span 
          className={`
            text-2xl font-bold text-primary block
            transition-all duration-300
            ${flip ? 'animate-pulse' : ''}
          `}
        >
          {value}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
};

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
        
        <div className="flex justify-center items-center gap-2" style={{ perspective: '500px' }}>
          <FlipCard value={formatNumber(timeLeft.days)} label="Days" />
          <span className="text-2xl font-bold text-primary mb-4 animate-pulse">:</span>
          <FlipCard value={formatNumber(timeLeft.hours)} label="Hrs" />
          <span className="text-2xl font-bold text-primary mb-4 animate-pulse">:</span>
          <FlipCard value={formatNumber(timeLeft.minutes)} label="Min" />
          <span className="text-2xl font-bold text-primary mb-4 animate-pulse">:</span>
          <FlipCard value={formatNumber(timeLeft.seconds)} label="Sec" />
        </div>
      </div>
    </section>
  );
};