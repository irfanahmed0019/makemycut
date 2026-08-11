import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AdminNotificationSound } from './AdminNotificationSound';

interface AdminRow { user_id: string; email: string; full_name: string | null }

export const AdminSettings = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminRow[]>([]);
  const [searching, setSearching] = useState(false);

  const loadAdmins = async () => {
    const { data } = await (supabase as any).rpc('admin_list_admins');
    setAdmins((data as AdminRow[]) || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('app_settings').select('text_value').eq('key', 'contact_email').maybeSingle();
      setEmail(data?.text_value || '');
      loadAdmins();
    })();
  }, []);

  const saveEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ variant: 'destructive', title: 'Invalid email' }); return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({ key: 'contact_email', text_value: email.trim(), bool_value: false }, { onConflict: 'key' });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Save failed', description: error.message }); return; }
    toast({ title: 'Contact email updated' });
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data, error } = await (supabase as any).rpc('admin_search_users', { p_query: query.trim() });
    setSearching(false);
    if (error) { toast({ variant: 'destructive', title: 'Search failed', description: error.message }); return; }
    setResults((data as AdminRow[]) || []);
  };

  const addAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    if (error && !error.message.includes('duplicate')) {
      toast({ variant: 'destructive', title: 'Failed', description: error.message }); return;
    }
    toast({ title: 'Admin added' });
    setResults([]); setQuery('');
    loadAdmins();
  };

  const removeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    if (error) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); return; }
    toast({ title: 'Admin removed' });
    loadAdmins();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Contact Us email</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@example.com" />
          <Button onClick={saveEmail} disabled={saving}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Admins</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email, name, phone or user ID" />
            <Button onClick={search} disabled={searching}>Search</Button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <div className="text-sm">
                    <p className="font-medium">{r.full_name || 'No name'}</p>
                    <p className="text-muted-foreground text-xs">{r.email}</p>
                  </div>
                  <Button size="sm" onClick={() => addAdmin(r.user_id)}>Make admin</Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
                <div className="text-sm">
                  <p className="font-medium">{a.full_name || 'No name'}</p>
                  <p className="text-muted-foreground text-xs">{a.email}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => removeAdmin(a.user_id)}>Remove</Button>
              </div>
            ))}
            {admins.length === 0 && <p className="text-sm text-muted-foreground">No admins found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};