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

  const downloadQR = (containerRef: React.RefObject<HTMLDivElement>, suffix: string) => {
    const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `makemycut-${slugify(salonName)}-${suffix}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'QR downloaded' });
  };

  const printQR = (url: string, label: string) => {
    const w = window.open('', '_blank', 'width=600,height=700');
    if (!w) return;
    w.document.write(`<html><head><title>${label} - ${salonName}</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff;color:#000;"><h2>${salonName}</h2><p>${label}</p><img id="q" alt="QR" /><p style="margin-top:24px;font-size:12px;">MakeMyCut</p><script>const c=document.createElement('canvas');const QR=window.opener;const i=document.getElementById('q');setTimeout(()=>window.print(),300);<\/script></body></html>`);
    // Simpler: re-render into the new window using a data URL captured from existing canvas
    const refCanvas = (label === 'Scan to Join Queue Instantly' ? queueRef : bookRef).current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (refCanvas) {
      const img = w.document.getElementById('q') as HTMLImageElement | null;
      if (img) img.src = refCanvas.toDataURL('image/png');
    }
  };

  const renderCard = (
    title: string,
    label: string,
    url: string,
    ref: React.RefObject<HTMLDivElement>,
    suffix: 'queue' | 'booking',
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={ref} className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-3">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeCanvas value={url} size={220} level="M" includeMargin={false} />
          </div>
          <p className="text-sm text-muted-foreground text-center">{label}</p>
          <p className="text-xs font-semibold text-foreground">MakeMyCut</p>
          <p className="text-xs text-muted-foreground">{salonName}</p>
        </div>
        <p className="text-xs text-muted-foreground break-all">{url}</p>
        <div className="flex gap-2">
          <Button variant="default" className="flex-1" onClick={() => downloadQR(ref, suffix)}>
            Download PNG
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => printQR(url, label)}>
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderCard('Queue QR', 'Scan to Join Queue Instantly', queueUrl, queueRef, 'queue')}
      {renderCard('Booking QR', 'Scan to Book an Appointment', bookUrl, bookRef, 'booking')}
    </div>
  );
}