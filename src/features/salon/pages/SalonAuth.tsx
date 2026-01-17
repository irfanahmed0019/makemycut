import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function SalonAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingSalon, setIsCheckingSalon] = useState(false);
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSalonOwner = async () => {
      if (user && !loading) {
        setIsCheckingSalon(true);
        const { data: barber } = await supabase
          .from('barbers')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        if (barber) {
          navigate('/salon-dashboard', { replace: true });
        } else {
          toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not registered as a salon owner.' });
        }
        setIsCheckingSalon(false);
      }
    };
    checkSalonOwner();
  }, [user, loading, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const validatedData = signInSchema.parse({ email, password });
      const { error } = await signIn(validatedData.email, validatedData.password);
      if (error) {
        toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
        setErrors(fieldErrors);
      }
    }
  };

  if (loading || isCheckingSalon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 text-card-foreground" style={{ fontFamily: 'serif' }}>Salon Dashboard</h1>
            <p className="text-lg text-muted-foreground" style={{ fontFamily: 'serif' }}>Login to manage your bookings</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="salon@example.com" className={errors.email ? 'border-destructive' : ''} />{errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}</div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className={errors.password ? 'border-destructive' : ''} />{errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}</div>
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => navigate('/auth')} className="text-sm text-muted-foreground hover:text-primary transition-colors">← Back to Customer Login</button>
          </div>
        </div>
      </div>
    </div>
  );
}
