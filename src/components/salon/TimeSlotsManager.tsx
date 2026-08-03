import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { SectionSkeleton } from '@/components/ui/skeleton';
import { to12h } from '@/features/customer/lib/slotAvailability';

interface Slot {
  id: string;
  slot_time: string;
  is_active: boolean;
}

interface TimeSlotsManagerProps {
  salonId: string;
}

export const TimeSlotsManager = ({ salonId }: TimeSlotsManagerProps) => {
  const { toast } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTime, setNewTime] = useState('10:00');
  const [editing, setEditing] = useState<{ id: string; time: string } | null>(null);

  const fetchSlots = async () => {
    const { data } = await (supabase as any)
      .from('salon_time_slots')
      .select('id, slot_time, is_active')
      .eq('salon_id', salonId)
      .order('slot_time');
    setSlots((data as Slot[]) || []);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  const handleAdd = async () => {
    if (!newTime) return;
    const { error } = await (supabase as any)
      .from('salon_time_slots')
      .insert({ salon_id: salonId, slot_time: `${newTime}:00` });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not add slot',
        description: error.code === '23505' ? 'That time already exists.' : error.message,
      });
      return;
    }
    fetchSlots();
    toast({ title: 'Time slot added' });
  };

  const handleToggle = async (slot: Slot) => {
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, is_active: !s.is_active } : s)));
    const { error } = await (supabase as any)
      .from('salon_time_slots')
      .update({ is_active: !slot.is_active })
      .eq('id', slot.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
      fetchSlots();
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const { error } = await (supabase as any)
      .from('salon_time_slots')
      .update({ slot_time: `${editing.time}:00` })
      .eq('id', editing.id);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Could not update slot',
        description: error.code === '23505' ? 'That time already exists.' : error.message,
      });
      return;
    }
    setEditing(null);
    fetchSlots();
    toast({ title: 'Time slot updated' });
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from('salon_time_slots').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not remove slot', description: error.message });
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== id));
    toast({ title: 'Time slot removed' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Booking Time Slots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Add a slot</Label>
            <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </div>
          <Button onClick={handleAdd}>Add</Button>
        </div>

        {isLoading ? (
          <SectionSkeleton rows={4} />
        ) : slots.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No slots yet — customers will see the default 10:00 AM – 5:30 PM times.
          </p>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border border-border rounded-lg p-3">
                {editing?.id === s.id ? (
                  <>
                    <Input
                      type="time"
                      className="flex-1"
                      value={editing.time}
                      onChange={(e) => setEditing({ id: s.id, time: e.target.value })}
                    />
                    <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 font-medium">{to12h(s.slot_time)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{s.is_active ? 'Active' : 'Hidden'}</span>
                      <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s)} />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ id: s.id, time: s.slot_time.slice(0, 5) })}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>Remove</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};