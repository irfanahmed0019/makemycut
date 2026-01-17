import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        if (!containerRef.current) return;

        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            html5QrCode.stop();
          },
          () => {
            // Ignore scan errors (no QR found in frame)
          }
        );
        setIsScanning(true);
      } catch (err) {
        console.error('Scanner error:', err);
        setError('Could not access camera. Please ensure camera permissions are granted.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan, isScanning]);

  return (
    <div className="min-h-screen bg-background p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scan Customer QR Code</CardTitle>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={onClose}>Go Back</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                id="qr-reader"
                ref={containerRef}
                className="w-full max-w-md mx-auto rounded-lg overflow-hidden"
              />
              <p className="text-center text-muted-foreground text-sm">
                Point the camera at the customer's QR code to check them in
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
