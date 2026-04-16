import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface OwnerSettingsTabProps {
  barberId: string;
  barberName: string;
}

export const OwnerSettingsTab = ({ barberId, barberName }: OwnerSettingsTabProps) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [barber, setBarber] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState({ name: '', duration_minutes: 30, price: 0 });
  const [showAddService, setShowAddService] = useState(false);

  const fetchAll = async () => {
    const [{ data: settingsData }, { data: barberData }, { data: servicesData }] = await Promise.all([
      supabase.from('salon_settings').select('*').eq('salon_id', barberId).maybeSingle(),
      supabase.from('barbers').select('*').eq('id', barberId).single(),
      supabase.from('services').select('*').eq('barber_id', barberId).order('order_index'),
    ]);
    setSettings(settingsData);
    setBarber(barberData);
    setServices(servicesData || []);
  };

  useEffect(() => { fetchAll(); }, [barberId]);

  const updateSettings = async (field: string, value: any) => {
    await supabase.from('salon_settings').update({ [field]: value }).eq('salon_id', barberId);
    setSettings((prev: any) => ({ ...prev, [field]: value }));
    toast({ title: 'Settings Updated' });
  };

  const updateBarber = async (field: string, value: any) => {
    await supabase.from('barbers').update({ [field]: value }).eq('id', barberId);
    setBarber((prev: any) => ({ ...prev, [field]: value }));
    toast({ title: 'Salon Info Updated' });
  };

  const handleAddService = async () => {
    if (!newService.name.trim()) return;
    const maxOrder = services.reduce((max, s) => Math.max(max, s.order_index || 0), 0);
    await supabase.from('services').insert({
      barber_id: barberId,
      name: newService.name,
      duration_minutes: newService.duration_minutes,
      price: newService.price,
      created_by: 'owner',
      order_index: maxOrder + 1,
    });
    setShowAddService(false);
    setNewService({ name: '', duration_minutes: 30, price: 0 });
    fetchAll();
    toast({ title: 'Service Added' });
  };

  const handleDeleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    setServices(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Service Deleted' });
  };

  if (!settings || !barber) return <div className="py-8 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="space-y-4">
      {/* Salon Info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Salon Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Salon Name</Label><Input value={barber.name} onBlur={e => updateBarber('name', e.target.value)} onChange={e => setBarber((p: any) => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Address</Label><Input value={barber.address || ''} onBlur={e => updateBarber('address', e.target.value)} onChange={e => setBarber((p: any) => ({ ...p, address: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Operating Hours</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Open Time</Label><Input type="time" value={settings.open_time?.slice(0,5)} onChange={e => updateSettings('open_time', e.target.value)} /></div>
            <div><Label>Close Time</Label><Input type="time" value={settings.close_time?.slice(0,5)} onChange={e => updateSettings('close_time', e.target.value)} /></div>
          </div>
          <div><Label>Slot Duration (minutes)</Label><Input type="number" value={settings.slot_duration} onChange={e => updateSettings('slot_duration', parseInt(e.target.value) || 30)} /></div>
          <div><Label>Default Wait/Customer (minutes)</Label><Input type="number" value={settings.wait_per_customer} onChange={e => updateSettings('wait_per_customer', parseInt(e.target.value) || 20)} /></div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Features</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Booking Enabled</Label>
            <Switch checked={settings.booking_enabled} onCheckedChange={v => updateSettings('booking_enabled', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Queue Enabled</Label>
            <Switch checked={settings.queue_enabled} onCheckedChange={v => updateSettings('queue_enabled', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Services</CardTitle>
          <Dialog open={showAddService} onOpenChange={setShowAddService}>
            <DialogTrigger asChild><Button size="sm">Add Service</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={newService.name} onChange={e => setNewService(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Duration (min)</Label><Input type="number" value={newService.duration_minutes} onChange={e => setNewService(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))} /></div>
                <div><Label>Price (₹)</Label><Input type="number" value={newService.price} onChange={e => setNewService(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></div>
                <Button onClick={handleAddService} className="w-full">Add Service</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {services.length === 0 && <p className="text-muted-foreground text-center py-4">No services yet</p>}
          {services.map(s => (
            <div key={s.id} className="flex items-center justify-between border border-border rounded-lg p-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.duration_minutes} min · ₹{s.price} · by {s.created_by}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteService(s.id)}>Delete</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
