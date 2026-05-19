import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Assignment {
  id: string;
  user_id: string;
  chair_id: string | null;
  is_active: boolean;
  profile?: { full_name: string | null; phone: string | null } | null;
}

interface Chair { id: string; chair_number: number; name: string | null; }

export const StaffManager = ({ salonId }: { salonId: string }) => {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [chairId, setChairId] = useState<string>('');

  const fetchAll = async () => {
    const [{ data: aData }, { data: cData }] = await Promise.all([
      supabase.from('barber_assignments').select('*').eq('salon_id', salonId).eq('is_active', true),
      supabase.from('chairs').select('id, chair_number, name').eq('salon_id', salonId).order('chair_number'),
    ]);

    const list = (aData as any[]) || [];
    // attach profile names
    const profiles = await Promise.all(
      list.map(async (a) => {
        const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', a.user_id).maybeSingle();
        return { ...a, profile: p };
      })
    );
    setAssignments(profiles as Assignment[]);
    setChairs((cData as Chair[]) || []);
    if (cData && cData.length && !chairId) setChairId(cData[0].id);
  };

  useEffect(() => { fetchAll(); }, [salonId]);

  const handleAssign = async () => {
    const uid = userId.trim();
    if (!uid) {
      toast({ variant: 'destructive', title: 'Missing user', description: 'Paste the barber\'s user ID. They must sign up first.' });
      return;
    }
    // Add user_roles entry as barber
    await supabase.from('user_roles').upsert({ user_id: uid, role: 'barber' as any });
    const { error } = await supabase.from('barber_assignments').insert({
      user_id: uid,
      salon_id: salonId,
      chair_id: chairId || null,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setUserId(''); setEmail('');
    fetchAll();
    toast({ title: 'Barber assigned' });
  };

  const handleRemove = async (id: string) => {
    await supabase.from('barber_assignments').update({ is_active: false, chair_id: null }).eq('id', id);
    fetchAll();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Barbers / Staff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Ask your barber to sign up first, then paste their user ID here to assign them to a chair. They'll then be able to sign in and see their own dashboard.
        </p>
        <div className="space-y-2">
          <div>
            <Label>Barber user ID</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid…" />
          </div>
          <div>
            <Label>Assign to chair</Label>
            <select
              value={chairId}
              onChange={(e) => setChairId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {chairs.length === 0 && <option value="">No chairs yet — add one first</option>}
              {chairs.map((c) => (
                <option key={c.id} value={c.id}>#{c.chair_number} — {c.name || 'Chair'}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAssign} disabled={!chairs.length}>Assign barber</Button>
        </div>

        <div className="space-y-2 pt-2">
          {assignments.length === 0 && <p className="text-sm text-muted-foreground">No staff assigned yet.</p>}
          {assignments.map((a) => {
            const c = chairs.find((x) => x.id === a.chair_id);
            return (
              <div key={a.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <div>
                  <p className="font-medium">{a.profile?.full_name || 'Barber'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.profile?.phone || a.user_id.slice(0, 8) + '…'}
                    {c ? ` · Chair #${c.chair_number}` : ' · Unassigned'}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleRemove(a.id)}>Remove</Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};