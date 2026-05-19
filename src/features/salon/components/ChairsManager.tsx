import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Chair {
  id: string;
  salon_id: string;
  chair_number: number;
  name: string | null;
  is_active: boolean;
}

export const ChairsManager = ({ salonId }: { salonId: string }) => {
  const { toast } = useToast();
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [name, setName] = useState('');

  const fetchChairs = async () => {
    const { data } = await supabase
      .from('chairs')
      .select('*')
      .eq('salon_id', salonId)
      .order('chair_number', { ascending: true });
    setChairs((data as Chair[]) || []);
  };

  useEffect(() => {
    fetchChairs();
  }, [salonId]);

  const handleAdd = async () => {
    const nextNum = chairs.reduce((m, c) => Math.max(m, c.chair_number), 0) + 1;
    const { error } = await supabase.from('chairs').insert({
      salon_id: salonId,
      chair_number: nextNum,
      name: name.trim() || `Chair ${nextNum}`,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setName('');
    fetchChairs();
    toast({ title: 'Chair added' });
  };

  const handleRename = async (id: string, newName: string) => {
    await supabase.from('chairs').update({ name: newName }).eq('id', id);
    fetchChairs();
  };

  const handleToggle = async (c: Chair) => {
    await supabase.from('chairs').update({ is_active: !c.is_active }).eq('id', c.id);
    fetchChairs();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('chairs').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Cannot delete', description: 'Chair may have bookings or assignments.' });
      return;
    }
    fetchChairs();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Chairs / Seats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>New chair name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Window seat" />
          </div>
          <Button onClick={handleAdd}>Add chair</Button>
        </div>

        {chairs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No chairs yet. Add one to enable per-chair booking and queues.</p>
        )}

        {chairs.map((c) => (
          <div key={c.id} className="flex items-center gap-2 border border-border rounded-lg p-3">
            <span className="font-bold w-8 text-center">#{c.chair_number}</span>
            <Input
              defaultValue={c.name ?? ''}
              onBlur={(e) => e.target.value !== c.name && handleRename(c.id, e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{c.is_active ? 'Active' : 'Off'}</span>
              <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} />
            </div>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>Delete</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};