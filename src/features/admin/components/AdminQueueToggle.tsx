import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useQueueEnabled, setQueueEnabled } from '@/hooks/useQueueEnabled';

/** Global kill-switch: turns the walk-in queue off everywhere at once. */
export const AdminQueueToggle = () => {
  const initial = useQueueEnabled();
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setEnabled(initial); }, [initial]);

  const handleChange = async (value: boolean) => {
    setSaving(true);
    setEnabled(value);
    const error = await setQueueEnabled(value);
    setSaving(false);
    if (error) {
      setEnabled(!value);
      toast({ variant: 'destructive', title: 'Could not save', description: error.message });
      return;
    }
    toast({ title: value ? 'Queue enabled everywhere' : 'Queue disabled everywhere' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Walk-in queue</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          When off, customers cannot join a queue and queue sections are hidden from barber and salon dashboards.
        </p>
        <Switch checked={enabled} disabled={saving} onCheckedChange={handleChange} />
      </CardContent>
    </Card>
  );
};
