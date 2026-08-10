import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useRatingsEnabled, setRatingsEnabled } from '@/hooks/useRatingsEnabled';

export const AdminRatingsToggle = () => {
  const initial = useRatingsEnabled();
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setEnabled(initial); }, [initial]);

  const handleChange = async (value: boolean) => {
    setSaving(true);
    setEnabled(value);
    const error = await setRatingsEnabled(value);
    setSaving(false);
    if (error) {
      setEnabled(!value);
      toast({ variant: 'destructive', title: 'Could not save', description: error.message });
      return;
    }
    toast({ title: value ? 'Ratings are now visible' : 'Ratings are now hidden' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Salon ratings</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Show star ratings and review counts on salon listings and salon pages.
        </p>
        <Switch checked={enabled} disabled={saving} onCheckedChange={handleChange} />
      </CardContent>
    </Card>
  );
};
