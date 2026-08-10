import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { COUNTRY_CODE, localDigits, phoneError, phoneRpcError } from '@/lib/phone';

/**
 * Asks any signed-in user without a saved mobile number for one.
 * The number is used by salons, barbers and admins to contact the customer.
 */
export function PhoneCaptureGate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) { setOpen(false); return; }
    (async () => {
      const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle();
      if (!active) return;
      setOpen(!data?.phone);
    })();
    return () => { active = false; };
  }, [user]);

  const handleSave = async () => {
    const err = phoneError(digits);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('set_my_phone', { p_phone: `${COUNTRY_CODE}${digits}` });
    setSaving(false);
    if (rpcError) { setError(phoneRpcError(rpcError.message)); return; }
    toast({ title: 'Number saved', description: 'Your salon can now reach you about your bookings.' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-serif">Add your mobile number</DialogTitle>
          <DialogDescription>
            Salons and barbers use this number to contact you about your booking. One number per account.
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
          {saving ? 'Saving…' : 'Save number'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default PhoneCaptureGate;
