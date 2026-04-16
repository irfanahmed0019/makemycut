import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Salon {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  owner_id: string | null;
}

interface SalonSettings {
  queue_enabled: boolean;
  booking_enabled: boolean;
  wait_per_customer: number;
}

export const AdminSalons = () => {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [settings, setSettings] = useState<Record<string, SalonSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);
  const [newSalon, setNewSalon] = useState({ name: '', address: '', description: '' });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const pendingDelete = useRef<{ id: string; timeout: NodeJS.Timeout } | null>(null);
  const { toast } = useToast();

  const fetchSalons = async () => {
    const { data } = await supabase.from('barbers').select('*').order('name');
    if (data) {
      setSalons(data);
      // Fetch settings for all salons
      const { data: settingsData } = await supabase.from('salon_settings').select('*');
      const settingsMap: Record<string, SalonSettings> = {};
      settingsData?.forEach((s: any) => {
        settingsMap[s.salon_id] = { queue_enabled: s.queue_enabled, booking_enabled: s.booking_enabled, wait_per_customer: s.wait_per_customer };
      });
      setSettings(settingsMap);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSalons(); }, []);

  const handleAddSalon = async () => {
    if (!newSalon.name.trim()) return;
    const { data, error } = await supabase.from('barbers').insert({ name: newSalon.name, address: newSalon.address || null, description: newSalon.description || null }).select().single();
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    // Create default settings
    await supabase.from('salon_settings').insert({ salon_id: data.id });
    setShowAddDialog(false);
    setNewSalon({ name: '', address: '', description: '' });
    fetchSalons();
    toast({ title: 'Salon Added' });
  };

  const handleUpdateSalon = async () => {
    if (!editingSalon) return;
    const { error } = await supabase.from('barbers').update({ name: editingSalon.name, address: editingSalon.address, description: editingSalon.description }).eq('id', editingSalon.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setEditingSalon(null);
    fetchSalons();
    toast({ title: 'Salon Updated' });
  };

  const handleDeleteSalon = (salonId: string) => {
    // Remove from UI immediately
    setSalons(prev => prev.filter(s => s.id !== salonId));
    const timeout = setTimeout(async () => {
      await supabase.from('barbers').delete().eq('id', salonId);
      pendingDelete.current = null;
    }, 5000);
    pendingDelete.current = { id: salonId, timeout };
    toast({
      title: 'Salon Deleted',
      description: 'Undo within 5 seconds',
      action: (
        <Button variant="outline" size="sm" onClick={() => {
          if (pendingDelete.current) {
            clearTimeout(pendingDelete.current.timeout);
            pendingDelete.current = null;
            fetchSalons();
          }
        }}>Undo</Button>
      ),
    });
  };

  const handleToggleFeature = async (salonId: string, field: 'queue_enabled' | 'booking_enabled', value: boolean) => {
    await supabase.from('salon_settings').update({ [field]: value }).eq('salon_id', salonId);
    setSettings(prev => ({ ...prev, [salonId]: { ...prev[salonId], [field]: value } }));
  };

  const handleUpdateWaitTime = async (salonId: string, value: number) => {
    await supabase.from('salon_settings').update({ wait_per_customer: value }).eq('salon_id', salonId);
    setSettings(prev => ({ ...prev, [salonId]: { ...prev[salonId], wait_per_customer: value } }));
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading salons...</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">All Salons ({salons.length})</h3>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild><Button>Add Salon</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Salon</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={newSalon.name} onChange={e => setNewSalon(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Address</Label><Input value={newSalon.address} onChange={e => setNewSalon(p => ({ ...p, address: e.target.value }))} /></div>
              <div><Label>Description</Label><Input value={newSalon.description} onChange={e => setNewSalon(p => ({ ...p, description: e.target.value }))} /></div>
              <Button onClick={handleAddSalon} className="w-full">Add Salon</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSalon} onOpenChange={(open) => !open && setEditingSalon(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Salon</DialogTitle></DialogHeader>
          {editingSalon && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editingSalon.name} onChange={e => setEditingSalon(p => p ? { ...p, name: e.target.value } : null)} /></div>
              <div><Label>Address</Label><Input value={editingSalon.address || ''} onChange={e => setEditingSalon(p => p ? { ...p, address: e.target.value } : null)} /></div>
              <div><Label>Description</Label><Input value={editingSalon.description || ''} onChange={e => setEditingSalon(p => p ? { ...p, description: e.target.value } : null)} /></div>
              <Button onClick={handleUpdateSalon} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {salons.map(salon => {
        const s = settings[salon.id] || { queue_enabled: true, booking_enabled: true, wait_per_customer: 20 };
        return (
          <Card key={salon.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">{salon.name}</h4>
                  {salon.address && <p className="text-sm text-muted-foreground">{salon.address}</p>}
                  <p className="text-sm text-muted-foreground">{salon.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSalon(salon)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteSalon(salon.id)}>Delete</Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Switch checked={s.booking_enabled} onCheckedChange={v => handleToggleFeature(salon.id, 'booking_enabled', v)} />
                  <span className="text-sm">Booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={s.queue_enabled} onCheckedChange={v => handleToggleFeature(salon.id, 'queue_enabled', v)} />
                  <span className="text-sm">Queue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Wait/customer:</span>
                  <Input type="number" className="w-20 h-8" value={s.wait_per_customer} onChange={e => handleUpdateWaitTime(salon.id, parseInt(e.target.value) || 20)} />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
