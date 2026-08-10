import { useState, useEffect } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { resolveUserRole } from '@/hooks/useUserRole';
import { homePathForRole } from '@/components/RoleGate';
import { authErrorMessage } from '@/lib/authErrors';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const validatedData = signInSchema.parse({ email, password });
      setIsCheckingSalon(true);
      const { error } = await signIn(validatedData.email, validatedData.password);
      if (error) {
        setIsCheckingSalon(false);
        toast({ variant: 'destructive', title: 'Login Failed', description: authErrorMessage(error) });
        return;
      }
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        setIsCheckingSalon(false);
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Could not start your session. Please try again.' });
        return;
      }
      const { role } = await resolveUserRole(uid);
      setIsCheckingSalon(false);
      if (role === 'customer') {
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not registered as a salon owner or barber.' });
      } else {
        navigate(homePathForRole(role), { replace: true });
      }
    } catch (error) {
      setIsCheckingSalon(false);
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
        setErrors(fieldErrors);
      }
    }
  };

  if (loading || isCheckingSalon) {
    return <PageSkeleton />;
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
