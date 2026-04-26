import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toSlug } from '@/lib/slug';

interface Salon {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  owner_id: string | null;
  district: string | null;
  area: string | null;
  is_verified: boolean | null;
  is_deleted: boolean | null;
  badge_type: string | null;
  status_tag: string | null;
}

interface SalonSettings {
  queue_enabled: boolean;
  booking_enabled: boolean;
  wait_per_customer: number;
}

type FilterMode = 'live' | 'removed' | 'all';
const BADGES = ['none', 'verified', 'new', 'featured', 'popular'] as const;
const STATUSES = ['none', 'open-now', 'closed-temporarily', 'coming-soon'] as const;

export const AdminSalons = () => {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [settings, setSettings] = useState<Record<string, SalonSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingSalon, setEditingSalon] = useState<Salon | null>(null);
  const [newSalon, setNewSalon] = useState({
    name: '', address: '', description: '',
    district: '', area: '', image_url: '',
    is_verified: true, badge_type: 'none', status_tag: 'none',
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('live');
  const pendingDelete = useRef<{ id: string; timeout: NodeJS.Timeout } | null>(null);
  const { toast } = useToast();

  const fetchSalons = async () => {
    const { data } = await supabase.from('barbers').select('*').order('name');
    if (data) {
      setSalons(data as unknown as Salon[]);
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
    const payload = {
      name: newSalon.name.trim(),
      address: newSalon.address || null,
      description: newSalon.description || null,
      district: newSalon.district ? toSlug(newSalon.district) : null,
      area: newSalon.area ? toSlug(newSalon.area) : null,
      image_url: newSalon.image_url || null,
      is_verified: newSalon.is_verified,
      badge_type: newSalon.badge_type === 'none' ? null : newSalon.badge_type,
      status_tag: newSalon.status_tag === 'none' ? null : newSalon.status_tag,
    };
    const { data, error } = await supabase.from('barbers').insert(payload).select().single();
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    // Create default settings
    await supabase.from('salon_settings').insert({ salon_id: data.id });
    setShowAddDialog(false);
    setNewSalon({ name: '', address: '', description: '', district: '', area: '', image_url: '', is_verified: true, badge_type: 'none', status_tag: 'none' });
    fetchSalons();
    toast({ title: 'Salon Added' });
  };

  const handleUpdateSalon = async () => {
    if (!editingSalon) return;
    const { error } = await supabase.from('barbers').update({
      name: editingSalon.name,
      address: editingSalon.address,
      description: editingSalon.description,
      district: editingSalon.district ? toSlug(editingSalon.district) : null,
      area: editingSalon.area ? toSlug(editingSalon.area) : null,
      image_url: editingSalon.image_url,
      is_verified: editingSalon.is_verified ?? true,
      badge_type: editingSalon.badge_type,
      status_tag: editingSalon.status_tag,
    }).eq('id', editingSalon.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setEditingSalon(null);
    fetchSalons();
    toast({ title: 'Salon Updated' });
  };

  // Soft delete (sets is_deleted = true). Hard delete is intentionally avoided.
  const handleSoftDelete = async (salonId: string) => {
    const { error } = await supabase.from('barbers').update({ is_deleted: true }).eq('id', salonId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    fetchSalons();
    toast({ title: 'Listing Removed', description: 'Hidden from public directory.' });
  };

  const handleRestore = async (salonId: string) => {
    const { error } = await supabase.from('barbers').update({ is_deleted: false }).eq('id', salonId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    fetchSalons();
    toast({ title: 'Listing Restored' });
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

  const filteredSalons = salons.filter((s) => {
    if (filter === 'live') return !s.is_deleted;
    if (filter === 'removed') return !!s.is_deleted;
    return true;
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Salons ({filteredSalons.length})</h3>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild><Button>Add Salon</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add New Salon</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={newSalon.name} onChange={e => setNewSalon(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>District *</Label><Input placeholder="e.g. trivandrum" value={newSalon.district} onChange={e => setNewSalon(p => ({ ...p, district: e.target.value }))} /></div>
                <div><Label>Area *</Label><Input placeholder="e.g. attingal" value={newSalon.area} onChange={e => setNewSalon(p => ({ ...p, area: e.target.value }))} /></div>
              </div>
              <div><Label>Address</Label><Input value={newSalon.address} onChange={e => setNewSalon(p => ({ ...p, address: e.target.value }))} /></div>
              <div><Label>Description</Label><Input value={newSalon.description} onChange={e => setNewSalon(p => ({ ...p, description: e.target.value }))} /></div>
              <div><Label>Image URL</Label><Input placeholder="Leave blank for placeholder" value={newSalon.image_url} onChange={e => setNewSalon(p => ({ ...p, image_url: e.target.value }))} /></div>
              <div className="flex items-center gap-2"><Switch checked={newSalon.is_verified} onCheckedChange={(v) => setNewSalon(p => ({ ...p, is_verified: v }))} /><Label>Verified</Label></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Badge</Label>
                  <Select value={newSalon.badge_type} onValueChange={(v) => setNewSalon(p => ({ ...p, badge_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BADGES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Tag</Label>
                  <Select value={newSalon.status_tag} onValueChange={(v) => setNewSalon(p => ({ ...p, status_tag: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddSalon} className="w-full">Add Salon</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="removed">Removed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingSalon} onOpenChange={(open) => !open && setEditingSalon(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Salon</DialogTitle></DialogHeader>
          {editingSalon && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editingSalon.name} onChange={e => setEditingSalon(p => p ? { ...p, name: e.target.value } : null)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>District</Label><Input value={editingSalon.district || ''} onChange={e => setEditingSalon(p => p ? { ...p, district: e.target.value } : null)} /></div>
                <div><Label>Area</Label><Input value={editingSalon.area || ''} onChange={e => setEditingSalon(p => p ? { ...p, area: e.target.value } : null)} /></div>
              </div>
              <div><Label>Address</Label><Input value={editingSalon.address || ''} onChange={e => setEditingSalon(p => p ? { ...p, address: e.target.value } : null)} /></div>
              <div><Label>Description</Label><Input value={editingSalon.description || ''} onChange={e => setEditingSalon(p => p ? { ...p, description: e.target.value } : null)} /></div>
              <div><Label>Image URL</Label><Input value={editingSalon.image_url || ''} onChange={e => setEditingSalon(p => p ? { ...p, image_url: e.target.value } : null)} /></div>
              <div className="flex items-center gap-2"><Switch checked={editingSalon.is_verified ?? true} onCheckedChange={(v) => setEditingSalon(p => p ? { ...p, is_verified: v } : null)} /><Label>Verified</Label></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Badge</Label>
                  <Select value={editingSalon.badge_type ?? 'none'} onValueChange={(v) => setEditingSalon(p => p ? { ...p, badge_type: v === 'none' ? null : v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BADGES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status Tag</Label>
                  <Select value={editingSalon.status_tag ?? 'none'} onValueChange={(v) => setEditingSalon(p => p ? { ...p, status_tag: v === 'none' ? null : v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleUpdateSalon} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {filteredSalons.map(salon => {
        const s = settings[salon.id] || { queue_enabled: true, booking_enabled: true, wait_per_customer: 20 };
        return (
          <Card key={salon.id} className={salon.is_deleted ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-foreground">
                    {salon.name}
                    {salon.is_deleted && <span className="ml-2 text-xs text-destructive">(Removed)</span>}
                  </h4>
                  {(salon.district || salon.area) && (
                    <p className="text-xs text-muted-foreground">/{salon.district ?? '?'}/{salon.area ?? '?'}</p>
                  )}
                  {salon.address && <p className="text-sm text-muted-foreground">{salon.address}</p>}
                  <p className="text-sm text-muted-foreground">{salon.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {salon.badge_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground">{salon.badge_type}</span>}
                    {salon.status_tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground">{salon.status_tag}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSalon(salon)}>Edit</Button>
                  {salon.is_deleted ? (
                    <Button variant="outline" size="sm" onClick={() => handleRestore(salon.id)}>Restore</Button>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={() => handleSoftDelete(salon.id)}>Remove</Button>
                  )}
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
