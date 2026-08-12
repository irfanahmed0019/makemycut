import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { COUNTRY_CODE, localDigits, phoneError, phoneRpcError } from '@/lib/phone';

interface PhoneCaptureGateProps {
  open: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Asked once, at booking time, when the account has no saved mobile number.
 * The number is saved to the account and used by salons, barbers and admins
 * to contact the customer about the booking.
 */
export function PhoneCaptureGate({ open, onSaved, onCancel }: PhoneCaptureGateProps) {
  const { toast } = useToast();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const err = phoneError(digits);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('set_my_phone', { p_phone: `${COUNTRY_CODE}${digits}` });
    setSaving(false);
    if (rpcError) { setError(phoneRpcError(rpcError.message)); return; }
    toast({ title: 'Number saved', description: 'Your salon can now reach you about your bookings.' });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">Confirm this booking</DialogTitle>
          <DialogDescription>
            Enter your phone number to confirm this booking. We only ask once — it is saved to your
            account so the salon can reach you about your appointment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="gate-phone">Mobile number</Label>
          <div className="flex items-end gap-2">
            <span className="h-12 flex items-center text-foreground border-b border-[hsl(0,0%,12%)] px-1">{COUNTRY_CODE}</span>
            <Input
              id="gate-phone"
              type="tel"
              inputMode="numeric"
              autoFocus
              value={digits}
              onChange={(e) => { setDigits(localDigits(e.target.value)); setError(null); }}
              placeholder="98765 43210"
              className="h-12 flex-1 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button onClick={handleSave} disabled={saving || digits.length !== 10} className="w-full h-12">
          {saving ? 'Saving…' : 'Confirm booking'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default PhoneCaptureGate;
