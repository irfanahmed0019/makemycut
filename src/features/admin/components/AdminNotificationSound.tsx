import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const SETTING_KEY = 'notification_sound_url';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Admin control for the branded in-app notification sound. */
export const AdminNotificationSound = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('app_settings').select('text_value').eq('key', SETTING_KEY).maybeSingle();
      setUrl(data?.text_value || '');
    })();
  }, []);

  const save = async (value: string) => {
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({ key: SETTING_KEY, text_value: value, bool_value: false }, { onConflict: 'key' });
    if (error) { toast({ variant: 'destructive', title: 'Save failed', description: error.message }); return false; }
    setUrl(value);
    toast({ title: value ? 'Notification sound updated' : 'Reverted to the default chime' });
    return true;
  };

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast({ variant: 'destructive', title: 'Please pick an audio file' }); return;
    }
    if (file.size > 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Keep it under 1 MB', description: 'Notification sounds should be very short.' });
      return;
    }
    setBusy(true);
    const path = `notification-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('notification-sounds').upload(path, file, {
      contentType: file.type, upsert: true,
    });
    if (upErr) {
      setBusy(false);
      toast({ variant: 'destructive', title: 'Upload failed', description: upErr.message });
      return;
    }
    const { data: signed } = await supabase.storage.from('notification-sounds').createSignedUrl(path, TEN_YEARS);
    setBusy(false);
    if (!signed?.signedUrl) { toast({ variant: 'destructive', title: 'Could not link the file' }); return; }
    await save(signed.signedUrl);
  };

  const preview = () => {
    if (!url) {
      window.dispatchEvent(new CustomEvent('mmc-preview-sound'));
      return;
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    void audio.play().catch(() => toast({ variant: 'destructive', title: 'Could not play the sound here' }));
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Notification sound</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Plays when a MakeMyCut notification arrives while the app is open. When the app is closed,
          phones always use their own system notification sound.
        </p>
        <p className="text-sm">
          Current: <span className="text-muted-foreground">{url ? 'Custom uploaded sound' : 'Built-in MakeMyCut chime'}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={preview}>Preview</Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : url ? 'Replace audio' : 'Upload audio'}
          </Button>
          {url && <Button size="sm" variant="destructive" onClick={() => save('')}>Use default chime</Button>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }}
        />
      </CardContent>
    </Card>
  );
};