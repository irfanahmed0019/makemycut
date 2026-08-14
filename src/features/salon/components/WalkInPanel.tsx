import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type Service = { id: string; name: string; price: number; duration_minutes: number };
type WalkIn = {
  id: string; salon_id: string; chair_id: string | null; barber_id: string | null;
  customer_name: string | null; customer_phone: string | null; service_id: string;
  status: string; created_at: string;
};
type Bill = {
  id: string; bill_number: string; source: string; walk_in_id: string | null; booking_id: string | null;
  customer_name: string | null; customer_phone: string | null; subtotal: number; discount: number;
  total: number; payment_method: string | null; payment_status: string; created_at: string;
};

const PAYMENT_METHODS: { key: 'cash' | 'upi' | 'card'; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
];

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
const money = (n: number) => `₹${Number(n || 0).toFixed(0)}`;

interface Props {
  salonId: string;
  salonName?: string;
  chairId?: string | null;
  /** Owners see revenue split; staff see the fast walk-in board. */
  showRevenue?: boolean;
}

export function WalkInPanel({ salonId, salonName, chairId, showRevenue }: Props) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [chairs, setChairs] = useState<{ id: string; chair_number: number; name: string | null }[]>([]);
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [pickedChair, setPickedChair] = useState<string>(chairId || '');
  const [history, setHistory] = useState<{ visits: number; name: string | null } | null>(null);
  const [receipt, setReceipt] = useState<{ bill: Bill; items: { name: string; price: number }[] } | null>(null);

  const load = useCallback(async () => {
    const [{ data: svc }, { data: ch }, { data: wi }, { data: bl }] = await Promise.all([
      supabase.from('services').select('id, name, price, duration_minutes').eq('barber_id', salonId).eq('is_active', true).order('order_index'),
      supabase.from('chairs').select('id, chair_number, name').eq('salon_id', salonId).eq('is_active', true).order('chair_number'),
      supabase.from('walk_ins').select('*').eq('salon_id', salonId).gte('created_at', startOfToday()).order('created_at'),
      supabase.from('bills').select('*').eq('salon_id', salonId).gte('created_at', startOfToday()).order('created_at', { ascending: false }),
    ]);
    setServices((svc || []) as Service[]);
    setChairs(ch || []);
    setWalkIns((wi || []) as WalkIn[]);
    setBills((bl || []) as Bill[]);
  }, [salonId]);

  useEffect(() => { if (salonId) load(); }, [salonId, load]);

  useEffect(() => {
    if (!salonId) return;
    const channel = supabase
      .channel(`walkins-${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_ins', filter: `salon_id=eq.${salonId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `salon_id=eq.${salonId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [salonId, load]);

  const serviceById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const billByWalkIn = useMemo(() => {
    const m: Record<string, Bill> = {};
    bills.forEach((b) => { if (b.walk_in_id) m[b.walk_in_id] = b; });
    return m;
  }, [bills]);

  // Newest walk-in first — the customer who just arrived is at the top of the board.
  const byNewest = (a: WalkIn, b: WalkIn) => (a.created_at < b.created_at ? 1 : -1);
  const active = walkIns.filter((w) => w.status === 'waiting' || w.status === 'in_service').sort(byNewest);
  const done = walkIns.filter((w) => w.status === 'completed').sort(byNewest);
  const paidBills = bills.filter((b) => b.payment_status === 'paid');
  const walkInRevenue = paidBills.filter((b) => b.source === 'walk_in').reduce((s, b) => s + Number(b.total), 0);
  const onlineRevenue = paidBills.filter((b) => b.source === 'online').reduce((s, b) => s + Number(b.total), 0);

  const checkPhone = async (value: string) => {
    setHistory(null);
    if (value.replace(/\D/g, '').length < 10) return;
    const { data } = await supabase.rpc('lookup_customer_history', { p_salon_id: salonId, p_phone: value });
    const row = (data as any[])?.[0];
    if (row) setHistory({ visits: row.visits, name: row.name });
  };

  const addWalkIn = async () => {
    if (!serviceId) { toast({ variant: 'destructive', title: 'Pick a service' }); return; }
    setSaving(true);
    const { error } = await supabase.rpc('create_walk_in', {
      p_salon_id: salonId,
      p_service_id: serviceId,
      p_customer_name: name || null,
      p_customer_phone: phone || null,
      p_chair_id: pickedChair || null,
    });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Could not add walk-in', description: error.message }); return; }
    toast({ title: 'Walk-in added' });
    setOpen(false); setName(''); setPhone(''); setServiceId(''); setHistory(null);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc('set_walk_in_status', { p_walk_in_id: id, p_status: status });
    if (error) { toast({ variant: 'destructive', title: 'Update failed', description: error.message }); return; }
    load();
  };

  const openReceipt = async (bill: Bill) => {
    const { data } = await supabase.from('bill_items').select('name, price').eq('bill_id', bill.id);
    setReceipt({ bill, items: (data || []) as any });
  };

  const generateBill = async (walkInId: string) => {
    const { data, error } = await supabase.rpc('generate_bill', { p_walk_in_id: walkInId });
    if (error) { toast({ variant: 'destructive', title: 'Billing failed', description: error.message }); return; }
    await load();
    const { data: bill } = await supabase.from('bills').select('*').eq('id', data as string).maybeSingle();
    if (bill) openReceipt(bill as Bill);
  };

  // Start = begin the cut and immediately raise the bill, so the barber only has to pick a payment method.
  const startAndBill = async (walkInId: string) => {
    await supabase.rpc('set_walk_in_status', { p_walk_in_id: walkInId, p_status: 'in_service' });
    await generateBill(walkInId);
  };

  const [paying, setPaying] = useState(false);
  const pay = async (billId: string, method: 'cash' | 'upi' | 'card') => {
    setPaying(true);
    const { error } = await supabase.rpc('record_payment', { p_bill_id: billId, p_method: method });
    setPaying(false);
    if (error) { toast({ variant: 'destructive', title: 'Payment failed', description: error.message }); return; }
    toast({ title: 'Payment recorded ✓' });
    const { data: bill } = await supabase.from('bills').select('*').eq('id', billId).maybeSingle();
    await load();
    if (bill) setReceipt((r) => (r ? { ...r, bill: bill as Bill } : r));
  };

  const printReceipt = () => {
    const node = document.getElementById('mmc-receipt');
    if (!node) return;
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) return;
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;padding:16px;font-size:13px}</style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Waiting', value: walkIns.filter((w) => w.status === 'waiting').length },
          { label: 'In service', value: walkIns.filter((w) => w.status === 'in_service').length },
          { label: 'Completed', value: done.length },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="font-display text-3xl text-primary">{s.value}</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showRevenue && (
        <Card>
          <CardContent className="p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Online revenue</span><span>{money(onlineRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Walk-in revenue</span><span>{money(walkInRevenue)}</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total (paid today)</span><span>{money(onlineRevenue + walkInRevenue)}</span></div>
          </CardContent>
        </Card>
      )}

      <Button className="w-full h-12 text-base" onClick={() => setOpen(true)}>+ Walk-In</Button>

      {active.length === 0 && done.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No walk-ins today.</p>
      )}

      {[...active, ...done].map((w) => {
        const bill = billByWalkIn[w.id];
        const svc = serviceById[w.service_id];
        return (
          <Card key={w.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{w.customer_name || 'Walk-in customer'}</p>
                  <p className="text-sm text-muted-foreground">{svc?.name || 'Service'} · {money(svc?.price ?? 0)}</p>
                  {w.customer_phone && (
                    <a href={`tel:${w.customer_phone}`} className="text-xs text-primary">{w.customer_phone}</a>
                  )}
                </div>
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider border-primary/40 text-primary">
                  {bill ? (bill.payment_status === 'paid' ? 'Paid' : 'Billed') : w.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {w.status === 'waiting' && (
                  <Button size="sm" onClick={() => startAndBill(w.id)}>Start</Button>
                )}
                {w.status === 'in_service' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (bill && bill.payment_status === 'unpaid') return openReceipt(bill);
                      if (bill) return setStatus(w.id, 'completed');
                      return startAndBill(w.id);
                    }}
                  >
                    {bill && bill.payment_status === 'unpaid' ? 'Confirm payment' : 'Complete'}
                  </Button>
                )}
                {!bill && w.status !== 'cancelled' && (
                  <Button size="sm" variant="outline" onClick={() => generateBill(w.id)}>Generate bill</Button>
                )}
                {bill && bill.payment_status === 'unpaid' && (
                  <Button size="sm" onClick={() => openReceipt(bill)}>Collect payment</Button>
                )}
                {bill && <Button size="sm" variant="ghost" onClick={() => openReceipt(bill)}>Receipt</Button>}
                {w.status === 'waiting' && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(w.id, 'cancelled')}>Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Walk-In</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Customer name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              placeholder="Phone number (optional)"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => checkPhone(e.target.value)}
            />
            {history && (
              <p className="text-xs text-primary">
                Existing customer found{history.name ? ` — ${history.name}` : ''} · {history.visits} previous visit{history.visits === 1 ? '' : 's'}
              </p>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm ${serviceId === s.id ? 'border-primary text-primary' : 'border-border'}`}
                >
                  <span>{s.name}</span>
                  <span>{money(s.price)}</span>
                </button>
              ))}
              {services.length === 0 && <p className="text-sm text-muted-foreground">No services configured yet.</p>}
            </div>
            {chairs.length > 0 && (
              <select
                value={pickedChair}
                onChange={(e) => setPickedChair(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Chair / barber (optional)</option>
                {chairs.map((c) => (
                  <option key={c.id} value={c.id}>#{c.chair_number}{c.name ? ` — ${c.name}` : ''}</option>
                ))}
              </select>
            )}
            <Button className="w-full" onClick={addWalkIn} disabled={saving}>
              {saving ? 'Adding…' : 'Add walk-in'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{receipt?.bill.payment_status === 'paid' ? 'Receipt' : 'Confirm payment'}</DialogTitle>
          </DialogHeader>
          {receipt && (
            <>
              <div id="mmc-receipt" className="font-mono text-sm space-y-1">
                <p className="text-center font-bold">MAKEMYCUT</p>
                <p className="text-center">{salonName || ''}</p>
                <p>Bill {receipt.bill.bill_number}</p>
                <p>{new Date(receipt.bill.created_at).toLocaleString()}</p>
                {receipt.bill.customer_name && <p>Customer: {receipt.bill.customer_name}</p>}
                <hr />
                {receipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between"><span>{i.name}</span><span>{money(i.price)}</span></div>
                ))}
                <hr />
                <div className="flex justify-between"><span>Subtotal</span><span>{money(receipt.bill.subtotal)}</span></div>
                {Number(receipt.bill.discount) > 0 && (
                  <div className="flex justify-between"><span>Discount</span><span>-{money(receipt.bill.discount)}</span></div>
                )}
                <div className="flex justify-between font-bold"><span>TOTAL</span><span>{money(receipt.bill.total)}</span></div>
                <p>Payment: {receipt.bill.payment_method?.toUpperCase() || '—'}</p>
                <p>Status: {receipt.bill.payment_status.toUpperCase()}</p>
                <p className="text-center">Thank you!</p>
              </div>
              {receipt.bill.payment_status === 'unpaid' ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">Select payment method to confirm this bill</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <Button key={m.key} disabled={paying} onClick={() => pay(receipt.bill.id, m.key)}>{m.label}</Button>
                    ))}
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={printReceipt}>Print / Save</Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}