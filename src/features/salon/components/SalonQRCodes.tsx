import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SalonQRCodesProps {
  salonId: string;
  salonName: string;
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://makemycut.lovable.app';
const TEMPLATE = '/posters/qr-poster.png';

// Base template is 719 x 1110 px. All coordinates below are in that space.
const TPL_W = 719;
const TPL_H = 1110;
const NAME_BOX = { x: 22, y: 184, w: 312, h: 56 };
const HEAD_BOX = { x: 14, y: 284, w: 330, h: 552 };
const QR_BOX = { x: 358, y: 440, w: 305, h: 313 };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'salon';
}

const loadTemplate = () =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = TEMPLATE;
  });

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

    const tpl = await loadTemplate().catch(() => null);
    if (!tpl) return null;

    const s = 2.5; // export scale -> ~1800 x 2775
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(TPL_W * s);
    canvas.height = Math.round(TPL_H * s);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(tpl, 0, 0, canvas.width, canvas.height);
    ctx.scale(s, s);
    ctx.textAlign = 'left';

    // --- Salon name -------------------------------------------------------
    ctx.fillStyle = '#000000';
    ctx.fillRect(NAME_BOX.x, NAME_BOX.y, NAME_BOX.w, NAME_BOX.h);
    ctx.fillStyle = '#FFFFFF';
    let fontSize = 40;
    const name = salonName.trim() || 'Your Salon';
    do {
      ctx.font = `700 ${fontSize}px "Playfair Display", Georgia, serif`;
      fontSize -= 1;
    } while (ctx.measureText(name).width > NAME_BOX.w - 12 && fontSize > 16);
    ctx.fillText(name, NAME_BOX.x + 8, NAME_BOX.y + NAME_BOX.h - 14);

    // --- Headline (queue variant re-writes the baked booking copy) --------
    if (variant === 'queue') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(HEAD_BOX.x, HEAD_BOX.y, HEAD_BOX.w, HEAD_BOX.h);

      const drawLines = (
        lines: string[],
        startY: number,
        size: number,
        color: string,
        lineGap: number,
      ) => {
        ctx.fillStyle = color;
        ctx.font = `800 ${size}px Poppins, Impact, sans-serif`;
        lines.forEach((l, i) => ctx.fillText(l, HEAD_BOX.x + 16, startY + i * lineGap));
      };

      drawLines(['TIRED OF', 'WAITING', 'IN LINE?'], 350, 62, '#EDE7DD', 68);
      drawLines(['JUST JOIN', 'THE QUEUE.'], 620, 58, '#D1282E', 64);

      ctx.fillStyle = '#EDE7DD';
      ctx.font = '700 26px Poppins, sans-serif';
      ctx.fillText('SCAN TO JOIN', HEAD_BOX.x + 16, 770);
      ctx.fillText('THE QUEUE.', HEAD_BOX.x + 16, 800);
    }

    // --- QR ---------------------------------------------------------------
    ctx.fillStyle = '#EFE9E0';
    ctx.fillRect(QR_BOX.x, QR_BOX.y, QR_BOX.w, QR_BOX.h);
    const size = Math.min(QR_BOX.w, QR_BOX.h) - 8;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      srcCanvas,
      QR_BOX.x + (QR_BOX.w - size) / 2,
      QR_BOX.y + (QR_BOX.h - size) / 2,
      size,
      size,
    );

    return canvas;
  };

  const downloadQR = async (variant: 'queue' | 'booking') => {
    const canvas = await renderPosterToCanvas(variant);
    if (!canvas) {
      toast({ variant: 'destructive', title: 'Could not build poster' });
      return;
    }
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
      `<html><head><title>MakeMyCut Poster - ${salonName}</title><style>html,body{margin:0;padding:0;background:#000;}img{display:block;width:100%;max-width:800px;margin:0 auto;}@media print{@page{margin:0;}}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>window.print(),200)"/></body></html>`,
    );
    w.document.close();
  };

  const renderCard = (
    title: string,
    url: string,
    ref: React.RefObject<HTMLDivElement>,
    suffix: 'queue' | 'booking',
  ) => {
    const pct = (v: number, total: number) => `${(v / total) * 100}%`;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={ref} className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-border">
            <img src={TEMPLATE} alt={`MakeMyCut ${suffix} poster for ${salonName}`} className="block w-full" />

            {/* Salon name */}
            <div
              className="absolute flex items-end bg-black"
              style={{
                left: pct(NAME_BOX.x, TPL_W),
                top: pct(NAME_BOX.y, TPL_H),
                width: pct(NAME_BOX.w, TPL_W),
                height: pct(NAME_BOX.h, TPL_H),
              }}
            >
              <span className="font-display truncate pl-2 pb-1 text-[5.5cqw] font-bold leading-none text-white [font-size:clamp(14px,5.5vw,26px)]">
                {salonName}
              </span>
            </div>

            {/* Queue headline override */}
            {suffix === 'queue' && (
              <div
                className="absolute bg-black px-3 pt-2"
                style={{
                  left: pct(HEAD_BOX.x, TPL_W),
                  top: pct(HEAD_BOX.y, TPL_H),
                  width: pct(HEAD_BOX.w, TPL_W),
                  height: pct(HEAD_BOX.h, TPL_H),
                }}
              >
                <p className="text-[#EDE7DD] font-extrabold leading-[0.95] [font-size:clamp(20px,8vw,40px)]">
                  TIRED OF<br />WAITING<br />IN LINE?
                </p>
                <p className="mt-3 text-primary font-extrabold leading-[0.95] [font-size:clamp(18px,7.5vw,38px)]">
                  JUST JOIN<br />THE QUEUE.
                </p>
                <p className="mt-3 text-[#EDE7DD] font-bold leading-tight [font-size:clamp(9px,3.2vw,16px)]">
                  SCAN TO JOIN<br />THE QUEUE.
                </p>
              </div>
            )}

            {/* QR */}
            <div
              className="absolute flex items-center justify-center bg-[#EFE9E0]"
              style={{
                left: pct(QR_BOX.x, TPL_W),
                top: pct(QR_BOX.y, TPL_H),
                width: pct(QR_BOX.w, TPL_W),
                height: pct(QR_BOX.h, TPL_H),
              }}
            >
              <QRCodeCanvas value={url} size={512} level="M" includeMargin={false} bgColor="#EFE9E0" className="!h-[95%] !w-[95%]" />
            </div>
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
      {renderCard('Booking QR', bookUrl, bookRef, 'booking')}
      {renderCard('Queue QR', queueUrl, queueRef, 'queue')}
    </div>
  );
}
