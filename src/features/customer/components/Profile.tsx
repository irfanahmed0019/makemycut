import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  full_name: string;
  phone: string;
  trust_score: number | null;
  upi_id: string;
  referral_code: string;
  avatar_url: string;
}

const isUpi = (v: string) => /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.trim());

export const Profile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData>({
    full_name: '', phone: '', trust_score: null, upi_id: '', referral_code: '', avatar_url: '',
  });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [upiOpen, setUpiOpen] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [savingUpi, setSavingUpi] = useState(false);

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        const refCode = data.referral_code || `MMC-${user.id.slice(0, 4).toUpperCase()}`;
        if (!data.referral_code) {
          await supabase.from('profiles').update({ referral_code: refCode }).eq('id', user.id);
        }
        setProfile({
          full_name: data.full_name || '',
          phone: data.phone || '',
          trust_score: data.trust_score == null ? null : Number(data.trust_score),
          upi_id: (data as any).upi_id || '',
          referral_code: refCode,
          avatar_url: data.avatar_url || '',
        });
        setEditName(data.full_name || '');
        setUpiInput((data as any).upi_id || '');
      }
    })();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editName.trim()) { toast({ variant: 'destructive', title: 'Name required' }); return; }
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: editName.trim() }).eq('id', user.id);
    setSavingProfile(false);
    if (error) { toast({ variant: 'destructive', title: 'Update failed', description: error.message }); return; }
    setProfile((p) => ({ ...p, full_name: editName.trim() }));
    setEditing(false);
    toast({ title: 'Profile updated' });
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 3 * 1024 * 1024) { toast({ variant: 'destructive', title: 'File too large', description: 'Max 3 MB.' }); return; }
    if (!file.type.startsWith('image/')) { toast({ variant: 'destructive', title: 'Invalid file' }); return; }
    setUploading(true);
    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); toast({ variant: 'destructive', title: 'Upload failed', description: upErr.message }); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    setUploading(false);
    if (updErr) { toast({ variant: 'destructive', title: 'Save failed', description: updErr.message }); return; }
    setProfile((p) => ({ ...p, avatar_url: url }));
    toast({ title: 'Profile updated' });
  };

  const handleSaveUpi = async () => {
    if (!user) return;
    if (!isUpi(upiInput)) { toast({ variant: 'destructive', title: 'Invalid UPI ID', description: 'Format: name@bank' }); return; }
    setSavingUpi(true);
    const { error } = await supabase.from('profiles').update({ upi_id: upiInput.trim() } as any).eq('id', user.id);
    setSavingUpi(false);
    if (error) { toast({ variant: 'destructive', title: 'Save failed', description: error.message }); return; }
    setProfile((p) => ({ ...p, upi_id: upiInput.trim() }));
    setUpiOpen(false);
    toast({ title: 'UPI ID saved' });
  };

  const handleShareApp = async () => {
    const text = "Book your haircut instantly — no waiting! 💈 makemycut.vercel.app/#";
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MakeMyCut', text });
        return;
      }
    } catch { /* fall through */ }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Link copied!' });
      return;
    } catch { /* fall through to WhatsApp */ }
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); return; }
    toast({ title: 'Password reset email sent' });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE' || !user) return;
    // Soft-deactivate: clear personal info; full deletion requires server-side admin call.
    const { error } = await supabase.from('profiles').update({
      full_name: 'Deleted User', phone: '', avatar_url: '', upi_id: '',
    } as any).eq('id', user.id);
    if (error) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); return; }
    toast({ title: 'Account deactivated' });
    setDeleteOpen(false);
    await signOut();
  };

  const trustDisplay = profile.trust_score == null ? 'New User' : profile.trust_score.toFixed(1);

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold text-center mb-4 text-card-foreground">My Profile</h2>
      <p className="text-sm text-center text-muted-foreground mb-6">Your account & preferences</p>

      {/* Profile card */}
      <div className="bg-card rounded-2xl p-4 flex items-center gap-4 mb-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 bg-muted rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
            aria-label="Change profile photo"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-4xl">person</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.currentTarget.value = ''; }}
          />
          {uploading && <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full text-xs">…</span>}
        </div>
        <div className="flex-grow">
          {editing ? (
            <div className="space-y-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" maxLength={80} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditName(profile.full_name); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-lg font-bold text-card-foreground">{profile.full_name || 'Customer'}</p>
              <p className="text-sm text-muted-foreground">{profile.phone || user?.email}</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setEditing(true)}>
                <span className="material-symbols-outlined text-base mr-2">edit</span>
                Edit Profile
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Settings list */}
      <div className="bg-card rounded-2xl p-4 space-y-2 mb-4">
        <h2 className="text-lg font-bold text-card-foreground mb-4">Account Settings</h2>

        {/* Trust score */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">shield</span>
            </div>
            <div>
              <p className="text-base text-foreground">Trust Score</p>
              <p className="text-xs text-muted-foreground">Based on your booking history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-yellow-400">{trustDisplay}</p>
            {profile.trust_score != null && <span className="material-symbols-outlined text-lg text-yellow-400">star</span>}
          </div>
        </div>

        {/* UPI / Payment methods */}
        <button
          type="button"
          onClick={() => setUpiOpen(true)}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-muted/40 rounded-lg px-1"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">credit_card</span>
            </div>
            <div>
              <p className="text-base text-foreground">Payment Methods</p>
              <p className="text-xs text-muted-foreground">{profile.upi_id || 'Add UPI ID'}</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
        </button>

        {/* Share MakeMyCut */}
        <button
          type="button"
          onClick={handleShareApp}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-muted/40 rounded-lg px-1"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">share</span>
            </div>
            <div>
              <p className="text-base text-foreground">Share MakeMyCut</p>
              <p className="text-xs text-muted-foreground">Invite friends to skip the wait</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
        </button>

        {/* Privacy */}
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-muted/40 rounded-lg px-1"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">lock</span>
            </div>
            <p className="text-base text-foreground">Privacy & Security</p>
          </div>
          <span className="material-symbols-outlined text-muted-foreground">chevron_right</span>
        </button>
      </div>

      <div className="px-4 py-3">
        <Button variant="default" className="w-full" onClick={signOut}>
          Log Out
        </Button>
      </div>

      {/* UPI Modal */}
      <Dialog open={upiOpen} onOpenChange={setUpiOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>UPI Payment Method</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="upi">UPI ID</Label>
            <Input id="upi" placeholder="yourname@upi" value={upiInput} onChange={(e) => setUpiInput(e.target.value)} />
            <p className="text-xs text-muted-foreground">Used for future in-app payments. Not charged now.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpiOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUpi} disabled={savingUpi}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Privacy Modal */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Privacy & Security</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <button onClick={handlePasswordReset} className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60">
              <span>Change Password</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <div className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/40">
              <span>Two-Factor Auth</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <button onClick={() => { setPrivacyOpen(false); setDeleteOpen(true); }} className="w-full flex items-center justify-between p-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive">
              <span>Delete Account</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle className="text-destructive">Delete Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This will deactivate your account and clear your personal info. Type <span className="font-mono font-bold">DELETE</span> to confirm.</p>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirm !== 'DELETE'} onClick={handleDeleteAccount}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
