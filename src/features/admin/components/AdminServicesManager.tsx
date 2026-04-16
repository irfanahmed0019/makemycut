import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface ServiceTemplate {
  name: string;
  duration_minutes: number;
  price: number;
}

export const AdminServicesManager = () => {
  const [salons, setSalons] = useState<any[]>([]);
  const [template, setTemplate] = useState<ServiceTemplate>({ name: '', duration_minutes: 30, price: 0 });
  const [selectedSalons, setSelectedSalons] = useState<string[]>([]);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const [{ data: salonsData }, { data: servicesData }] = await Promise.all([
        supabase.from('barbers').select('id, name').order('name'),
        supabase.from('services').select('*, barbers:barber_id(name)').order('name'),
      ]);
      setSalons(salonsData || []);
      setServices(servicesData || []);
    };
    fetch();
  }, []);

  const handlePushTemplate = async () => {
    if (!template.name.trim() || selectedSalons.length === 0) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Enter a service name and select at least one salon.' });
      return;
    }

    const inserts = selectedSalons.map(salonId => ({
      barber_id: salonId,
      name: template.name,
      duration_minutes: template.duration_minutes,
      price: template.price,
      created_by: 'admin',
    }));

    const { error } = await supabase.from('services').insert(inserts);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }

    toast({ title: 'Service pushed', description: `"${template.name}" added to ${selectedSalons.length} salon(s)` });
    setShowPushDialog(false);
    setTemplate({ name: '', duration_minutes: 30, price: 0 });
    setSelectedSalons([]);
    // Refresh services
    const { data } = await supabase.from('services').select('*, barbers:barber_id(name)').order('name');
    setServices(data || []);
  };

  const toggleSalon = (id: string) => {
    setSelectedSalons(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleDeleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    setServices(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Service deleted' });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Global Services Manager</h3>
        <Dialog open={showPushDialog} onOpenChange={setShowPushDialog}>
          <DialogTrigger asChild><Button>Push Service Template</Button></DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create & Push Service Template</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Service Name</Label><Input value={template.name} onChange={e => setTemplate(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={template.duration_minutes} onChange={e => setTemplate(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))} /></div>
              <div><Label>Price (₹)</Label><Input type="number" value={template.price} onChange={e => setTemplate(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></div>
              <div>
                <Label className="mb-2 block">Select Salons</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {salons.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedSalons.includes(s.id)} onCheckedChange={() => toggleSalon(s.id)} />
                      <span className="text-sm">{s.name}</span>
                    </label>
                  ))}
                </div>
                <Button variant="link" size="sm" className="mt-1 p-0" onClick={() => setSelectedSalons(salons.map(s => s.id))}>Select All</Button>
              </div>
              <Button onClick={handlePushTemplate} className="w-full">Push to {selectedSalons.length} Salon(s)</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {services.map(s => (
          <Card key={s.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.barbers?.name} · {s.duration_minutes}min · ₹{s.price}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteService(s.id)}>Delete</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
