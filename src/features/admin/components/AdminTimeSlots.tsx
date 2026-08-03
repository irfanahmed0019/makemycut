import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionSkeleton } from '@/components/ui/skeleton';
import { TimeSlotsManager } from '@/components/salon/TimeSlotsManager';

export const AdminTimeSlots = () => {
  const [salons, setSalons] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('barbers').select('id, name').order('name');
      setSalons(data || []);
      if (data && data.length > 0) setSelected((c) => c || data[0].id);
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) return <SectionSkeleton rows={4} />;

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label>Salon</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Select a salon" /></SelectTrigger>
          <SelectContent>
            {salons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {selected && <TimeSlotsManager salonId={selected} />}
    </div>
  );
};