import { useState, useEffect, useRef } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const FlipDigit = ({ value, prevValue }: { value: string; prevValue: string }) => {
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (value !== prevValue) {
      setIsFlipping(true);
      const timer = setTimeout(() => setIsFlipping(false), 600);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  return (
    <div className="relative w-[28px] h-[44px] mx-[1px]" style={{ perspective: '200px' }}>
      {/* Static bottom half - shows new number */}
      <div className="absolute inset-0 overflow-hidden rounded-md">
        <div className="absolute inset-0 bg-card border border-border rounded-md" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">{value}</span>
        </div>
        {/* Bottom half shadow overlay */}
        <div className="absolute top-1/2 left-0 right-0 bottom-0 bg-gradient-to-b from-black/10 to-transparent rounded-b-md" />
      </div>

      {/* Top half static - shows new number behind */}
      <div className="absolute top-0 left-0 right-0 h-1/2 overflow-hidden rounded-t-md">
        <div className="absolute inset-0 bg-card border-x border-t border-border" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary translate-y-1/2">{value}</span>
        </div>
      </div>

      {/* Flipping top card - shows old number, flips down */}
      <div
        className={`absolute top-0 left-0 right-0 h-1/2 overflow-hidden rounded-t-md ${isFlipping ? 'z-20' : 'z-10'}`}
        style={{
          transformOrigin: 'bottom center',
          transform: isFlipping ? 'rotateX(-180deg)' : 'rotateX(0deg)',
          transition: 'transform 0.3s ease-in',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-card border-x border-t border-border" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary translate-y-1/2">{prevValue}</span>
        </div>
      </div>

      {/* Flipping bottom card - shows new number, comes from behind */}
      <div
        className={`absolute top-1/2 left-0 right-0 h-1/2 overflow-hidden rounded-b-md ${isFlipping ? 'z-20' : 'z-0'}`}
        style={{
          transformOrigin: 'top center',
          transform: isFlipping ? 'rotateX(0deg)' : 'rotateX(180deg)',
          transition: isFlipping ? 'transform 0.3s ease-out 0.3s' : 'none',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 bg-card border-x border-b border-border" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary -translate-y-1/2">{value}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
      </div>

      {/* Center line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-border/50 z-30" />
    </div>
  );
};

const FlipCard = ({ value, label }: { value: string; label: string }) => {
  const [currentValue, setCurrentValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  useEffect(() => {
    if (value !== currentValue) {
      setPrevValue(currentValue);
      setCurrentValue(value);
    }
  }, [value, currentValue]);

  const digits = value.split('');
  const prevDigits = prevValue.split('');

  return (
    <div className="flex flex-col items-center">
      <div className="flex">
        {digits.map((digit, index) => (
          <FlipDigit 
            key={index} 
            value={digit} 
            prevValue={prevDigits[index] || '0'} 
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground mt-2">{label}</span>
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
        
        <div className="flex justify-center items-center gap-3">
          <FlipCard value={formatNumber(timeLeft.days)} label="Days" />
          <span className="text-2xl font-bold text-primary/60 mb-6">:</span>
          <FlipCard value={formatNumber(timeLeft.hours)} label="Hrs" />
          <span className="text-2xl font-bold text-primary/60 mb-6">:</span>
          <FlipCard value={formatNumber(timeLeft.minutes)} label="Min" />
          <span className="text-2xl font-bold text-primary/60 mb-6">:</span>
          <FlipCard value={formatNumber(timeLeft.seconds)} label="Sec" />
        </div>
      </div>
    </section>
  );
};
