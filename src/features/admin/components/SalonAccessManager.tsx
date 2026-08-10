import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface FoundUser { user_id: string; email: string | null; full_name: string | null; phone: string | null }
interface Chair { id: string; chair_number: number; name: string | null }
interface Assignment { id: string; user_id: string; chair_id: string | null; user?: FoundUser | null }

/**
 * Admin-only access control for a salon: who owns the Salon Dashboard and
 * which accounts get a Barber Dashboard (and on which chair).
 */
export const SalonAccessManager = ({ salonId, ownerId, onOwnerChange }: {
  salonId: string;
  ownerId: string | null;
  onOwnerChange: (ownerId: string | null) => void;
}) => {
  const { toast } = useToast();
  const [owner, setOwner] = useState<FoundUser | null>(null);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoundUser | null>(null);
  const [newChairId, setNewChairId] = useState<string>('none');

  const lookup = async (id: string): Promise<FoundUser | null> => {
    const { data } = await supabase.rpc('admin_lookup_user', { p_user_id: id });
    return (data as FoundUser[])?.[0] ?? null;
  };

  const refresh = async () => {
    const [{ data: chairData }, { data: assignData }] = await Promise.all([
      supabase.from('chairs').select('id, chair_number, name').eq('salon_id', salonId).order('chair_number'),
      supabase.from('barber_assignments').select('id, user_id, chair_id').eq('salon_id', salonId).eq('is_active', true),
    ]);
    setChairs((chairData as Chair[]) || []);
    const list = ((assignData as any[]) || []);
    const withUsers = await Promise.all(list.map(async (a) => ({ ...a, user: await lookup(a.user_id) })));
    setAssignments(withUsers as Assignment[]);
    setOwner(ownerId ? await lookup(ownerId) : null);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [salonId, ownerId]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() });
    setSearching(false);
    if (error) { toast({ variant: 'destructive', title: 'Search failed', description: error.message }); return; }
    setResults((data as FoundUser[]) || []);
    if (!data || (data as any[]).length === 0) {
      toast({ title: 'No accounts found', description: 'The person must sign up first.' });
    }
  };

  const label = (u: FoundUser | null) =>
    u ? `${u.full_name || 'Unnamed'} · ${u.email || u.user_id.slice(0, 8)}` : 'Unknown account';

  const setAsOwner = async (u: FoundUser) => {
    const { error } = await supabase.from('barbers').update({ owner_id: u.user_id }).eq('id', salonId);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    onOwnerChange(u.user_id);
    toast({ title: 'Salon owner updated', description: `${label(u)} can now open the Salon Dashboard.` });
  };

  const clearOwner = async () => {
    const { error } = await supabase.from('barbers').update({ owner_id: null }).eq('id', salonId);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    onOwnerChange(null);
    toast({ title: 'Owner removed' });
  };

  const addBarber = async (u: FoundUser) => {
    if (assignments.some((a) => a.user_id === u.user_id)) {
      toast({ variant: 'destructive', title: 'Already a barber here' });
      return;
    }
    await supabase.from('user_roles').upsert({ user_id: u.user_id, role: 'barber' as any }, { onConflict: 'user_id,role' });
    const { error } = await supabase.from('barber_assignments').insert({
      user_id: u.user_id,
      salon_id: salonId,
      chair_id: newChairId === 'none' ? null : newChairId,
    });
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    await refresh();
    toast({ title: 'Barber added', description: `${label(u)} now has a Barber Dashboard.` });
  };

  const updateChair = async (assignmentId: string, chairId: string) => {
    const { error } = await supabase.from('barber_assignments')
      .update({ chair_id: chairId === 'none' ? null : chairId }).eq('id', assignmentId);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    await refresh();
    toast({ title: 'Chair updated' });
  };

  const removeBarber = async (a: Assignment) => {
    await supabase.from('barber_assignments').update({ is_active: false, chair_id: null }).eq('id', a.id);
    await supabase.from('user_roles').delete().eq('user_id', a.user_id).eq('role', 'barber' as any);
    await refresh();
    toast({ title: 'Barber removed' });
  };

  return (
    <div className="space-y-5">
      {/* Owner */}
      <div className="space-y-2">
        <Label>Salon Dashboard owner</Label>
        {ownerId ? (
          <div className="flex items-center justify-between border border-border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">{label(owner)}</p>
              <p className="text-xs text-muted-foreground break-all">{ownerId}</p>
            </div>
            <Button size="sm" variant="destructive" onClick={clearOwner}>Remove</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No owner assigned — search below and set one.</p>
        )}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label>Find an account</Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Email, name, phone or user ID"
          />
          <Button onClick={handleSearch} disabled={searching}>{searching ? '…' : 'Search'}</Button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Chair for new barber</Label>
              <Select value={newChairId} onValueChange={setNewChairId}>
                <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No chair</SelectItem>
                  {chairs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>#{c.chair_number} — {c.name || 'Chair'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {results.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email} {u.phone ? `· ${u.phone}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setAsOwner(u)}>Make owner</Button>
                  <Button size="sm" onClick={() => addBarber(u)}>Add barber</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barbers */}
      <div className="space-y-2">
        <Label>Barber Dashboard access ({assignments.length})</Label>
        {assignments.length === 0 && <p className="text-sm text-muted-foreground">No barbers assigned yet.</p>}
        {assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.user?.full_name || 'Barber'}</p>
              <p className="text-xs text-muted-foreground truncate">{a.user?.email || a.user_id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={a.chair_id ?? 'none'} onValueChange={(v) => updateChair(a.id, v)}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No chair</SelectItem>
                  {chairs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>#{c.chair_number} — {c.name || 'Chair'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" onClick={() => removeBarber(a)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalonAccessManager;
