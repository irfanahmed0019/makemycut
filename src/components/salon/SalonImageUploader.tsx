import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Bucket is private, so we store a long-lived signed URL on the salon record.
const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;
const MAX_BYTES = 5 * 1024 * 1024;

interface SalonImageUploaderProps {
  salonId: string;
  imageUrl: string | null;
  onUploaded: (url: string) => void;
  label?: string;
}

export const SalonImageUploader = ({ salonId, imageUrl, onUploaded, label = 'Salon photo' }: SalonImageUploaderProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Please pick an image file' });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ variant: 'destructive', title: 'Image too large', description: 'Maximum size is 5 MB.' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${salonId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('salon-images')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data, error: signError } = await supabase.storage
        .from('salon-images')
        .createSignedUrl(path, TEN_YEARS_SECONDS);
      if (signError || !data?.signedUrl) throw signError ?? new Error('Could not create image link');

      const { error: saveError } = await supabase
        .from('barbers')
        .update({ image_url: data.signedUrl })
        .eq('id', salonId);
      if (saveError) throw saveError;

      onUploaded(data.signedUrl);
      toast({ title: 'Salon photo updated' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 overflow-hidden rounded-lg bg-secondary flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="Salon" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="material-symbols-outlined text-muted-foreground">image</span>
          )}
        </div>
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          <p className="text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
};
