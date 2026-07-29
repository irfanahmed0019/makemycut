import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SalonQRCodesProps {
  salonId: string;
  salonName: string;
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://makemycut.vercel.app';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';
}

export function SalonQRCodes({ salonId, salonName }: SalonQRCodesProps) {
  const { toast } = useToast();
  const queueRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);

  const queueUrl = `${ORIGIN}/join-queue?salon=${salonId}`;
  const bookUrl = `${ORIGIN}/book?salon=${salonId}`;

  const renderPosterToCanvas = async (
    variant: 'queue' | 'booking',
  ): Promise<HTMLCanvasElement | null> => {
    const srcCanvas = (variant === 'queue' ? queueRef : bookRef).current?.querySelector(
      'canvas',
    ) as HTMLCanvasElement | null;
    if (!srcCanvas) return null;

    const W = 1080;
    const H = 1500;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background: dark radial-ish gradient matching site theme
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#141014');
    bg.addColorStop(1, '#050505');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Red glow blob top
    const glow = ctx.createRadialGradient(W / 2, -100, 40, W / 2, -100, 700);
    glow.addColorStop(0, 'rgba(209, 40, 46, 0.55)');
    glow.addColorStop(1, 'rgba(209, 40, 46, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 900);

    // Outer border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Brand mark
    ctx.fillStyle = '#D1282E';
    ctx.font = '700 44px Poppins, Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MakeMyCut', W / 2, 160);

    // Thin divider
    ctx.strokeStyle = 'rgba(209,40,46,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 190);
    ctx.lineTo(W / 2 + 60, 190);
    ctx.stroke();

    // Availability line
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '500 30px Poppins, sans-serif';
    ctx.fillText('MakeMyCut is available at this salon', W / 2, 245);

    // Salon name (headline)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 62px "Playfair Display", serif';
    const name = salonName.length > 26 ? salonName.slice(0, 25) + '…' : salonName;
    ctx.fillText(name, W / 2, 340);

    // Big action headline
    const headline =
      variant === 'queue'
        ? ["DON'T WASTE YOUR DAY IN LINE.", 'JOIN THE VIRTUAL QUEUE.']
        : ["DON'T WANT TO WAIT IN LINE?"];
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 54px Poppins, sans-serif';
    if (headline.length === 2) {
      ctx.fillText(headline[0], W / 2, 420);
      ctx.fillText(headline[1], W / 2, 480);
    } else {
      ctx.fillText(headline[0], W / 2, 445);
    }

    // Sub caption
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '400 26px Poppins, sans-serif';
    const sub =
      variant === 'queue'
        ? 'Scan • Track • Walk In'
        : 'Reserve your chair before you arrive. Scan the QR code to book your appointment.';
    ctx.fillText(sub, W / 2, 535);

    // QR panel (white rounded card)
    const qrPanel = { x: (W - 620) / 2, y: 545, w: 620, h: 620, r: 32 };
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, qrPanel.x, qrPanel.y, qrPanel.w, qrPanel.h, qrPanel.r);
    ctx.fill();
    // subtle red inner border
    ctx.strokeStyle = 'rgba(209,40,46,0.9)';
    ctx.lineWidth = 4;
    roundRect(ctx, qrPanel.x + 6, qrPanel.y + 6, qrPanel.w - 12, qrPanel.h - 12, qrPanel.r - 6);
    ctx.stroke();

    // Draw QR centered inside panel
    const qrSize = 520;
    ctx.drawImage(
      srcCanvas,
      qrPanel.x + (qrPanel.w - qrSize) / 2,
      qrPanel.y + (qrPanel.h - qrSize) / 2,
      qrSize,
      qrSize,
    );

    // Steps footer
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 30px Poppins, sans-serif';
    ctx.fillText('Open Camera  •  Point at QR  •  Tap the link', W / 2, 1245);

    // Action pill
    const pillLabel = variant === 'queue' ? 'JOIN QUEUE INSTANTLY' : 'BOOK IN SECONDS';
    ctx.font = '700 28px Poppins, sans-serif';
    const tw = ctx.measureText(pillLabel).width;
    const pill = { w: tw + 80, h: 68 };
    const px = (W - pill.w) / 2;
    const py = 1290;
    ctx.fillStyle = '#D1282E';
    roundRect(ctx, px, py, pill.w, pill.h, 34);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(pillLabel, W / 2, py + pill.h / 2 + 2);
    ctx.textBaseline = 'alphabetic';

    // Footer tagline
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '400 22px Poppins, sans-serif';
    ctx.fillText('Skip the wait. Book haircuts & salons instantly.', W / 2, 1420);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 18px Poppins, sans-serif';
    ctx.fillText('makemycut.vercel.app', W / 2, 1450);

    return canvas;
  };

  const downloadQR = async (variant: 'queue' | 'booking') => {
    const canvas = await renderPosterToCanvas(variant);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `makemycut-${slugify(salonName)}-${variant}-poster.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'Poster downloaded' });
  };

  const printQR = async (variant: 'queue' | 'booking') => {
    const canvas = await renderPosterToCanvas(variant);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return;
    w.document.write(
      `<html><head><title>MakeMyCut Poster - ${salonName}</title><style>html,body{margin:0;padding:0;background:#050505;}img{display:block;width:100%;max-width:800px;margin:0 auto;}@media print{@page{margin:0;}}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>window.print(),200)"/></body></html>`,
    );
    w.document.close();
  };

  const renderCard = (
    title: string,
    label: string,
    url: string,
    ref: React.RefObject<HTMLDivElement>,
    suffix: 'queue' | 'booking',
  ) => {
    const headline =
      suffix === 'queue'
        ? ["DON'T WASTE YOUR DAY IN LINE.", 'JOIN THE VIRTUAL QUEUE.']
        : ["DON'T WANT TO WAIT IN LINE?"];
    const sub =
      suffix === 'queue'
        ? 'Scan • Track • Walk In'
        : 'Reserve your chair before you arrive. Scan the QR code to book your appointment.';
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Live poster preview themed to the site palette */}
          <div
            ref={ref}
            className="relative overflow-hidden rounded-2xl border border-border p-6 flex flex-col items-center gap-4 text-center"
            style={{
              background:
                'radial-gradient(ellipse at top, hsl(359 70% 20% / 0.55), transparent 60%), linear-gradient(180deg, #141014 0%, #050505 100%)',
            }}
          >
            <div className="space-y-1">
              <p className="font-display text-primary text-xl font-bold tracking-wide">MakeMyCut</p>
              <div className="mx-auto h-px w-12 bg-primary/70" />
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                Available at this salon
              </p>
            </div>

            <div>
              <p className="font-display text-white text-2xl font-bold leading-tight">
                {salonName}
              </p>
            </div>

            <div className="space-y-1">
              {Array.isArray(headline) ? (
                headline.map((line, i) => (
                  <p key={i} className="text-white font-extrabold text-base tracking-wide">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-white font-extrabold text-base tracking-wide">{headline}</p>
              )}
              <p className="text-white/55 text-xs max-w-[260px] mx-auto">{sub}</p>
            </div>

            <div className="bg-white p-3 rounded-xl ring-2 ring-primary/70 shadow-[0_0_30px_-8px_hsl(var(--brand-red)/0.5)]">
              <QRCodeCanvas value={url} size={200} level="M" includeMargin={false} />
            </div>

            <p className="text-white/70 text-[11px]">
              Open Camera · Point at QR · Tap the link
            </p>

            <span className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white">
              {suffix === 'queue' ? 'Join Queue Instantly' : 'Book in Seconds'}
            </span>

            <p className="text-white/35 text-[10px]">makemycut.vercel.app</p>
          </div>

          <p className="text-xs text-muted-foreground break-all">{url}</p>
          <div className="flex gap-2">
            <Button variant="default" className="flex-1" onClick={() => downloadQR(suffix)}>
              Download Poster
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => printQR(suffix)}>
              Print
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderCard('Queue QR', 'Scan to Join Queue Instantly', queueUrl, queueRef, 'queue')}
      {renderCard('Booking QR', 'Scan to Book an Appointment', bookUrl, bookRef, 'booking')}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}