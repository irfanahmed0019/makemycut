import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  phone: z.string().trim().regex(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Invalid phone number format'),
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
});

const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required'),
});

type AuthView = 'login' | 'signup' | 'forgot-password' | 'otp-request' | 'otp-verify';

export default function CustomerAuth() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Email Sent', description: 'Check your inbox for the password reset link.' });
        setAuthView('login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'OTP Sent', description: 'Check your email for the verification code.' });
        setAuthView('otp-verify');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'email' });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Success', description: 'You have been signed in successfully.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      if (authView === 'login') {
        const validatedData = signInSchema.parse({ email, password });
        await signIn(validatedData.email, validatedData.password);
      } else if (authView === 'signup') {
        const validatedData = signUpSchema.parse({ fullName, phone, email, password });
        await signUp(validatedData.email, validatedData.password, validatedData.fullName, validatedData.phone);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
        setErrors(fieldErrors);
        toast({ variant: 'destructive', title: 'Validation Error', description: error.errors[0].message });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-serif italic text-primary leading-tight">
            Make My<br />Cut
          </h1>
          <p className="text-primary/80 italic mt-3 text-lg tracking-wide">Your Style. Your Time.</p>
        </div>

        {authView === 'login' && (
          <div className="space-y-6">
            {/* Google Button */}
            <Button 
              type="button" 
              variant="outline"
              className="w-full h-14 text-base font-medium bg-card-foreground text-background hover:bg-card-foreground/90 border-0 rounded-full"
              onClick={signInWithGoogle}
            >
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-4 text-muted-foreground">OR</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-foreground">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-foreground">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.password ? 'border-destructive' : ''}`}
                />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-base font-semibold rounded-lg mt-6"
              >
                Step Inside
              </Button>
            </form>

            {/* Footer Links */}
            <div className="text-center space-y-3 pt-2">
              <button 
                type="button" 
                onClick={() => setAuthView('signup')} 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Don't have an account? <span className="text-foreground font-medium">Sign up</span>
              </button>
              <div className="flex justify-center gap-4 text-xs">
                <button type="button" onClick={() => setAuthView('otp-request')} className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign in with OTP
                </button>
                <button type="button" onClick={() => setAuthView('forgot-password')} className="text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </button>
              </div>
            </div>
          </div>
        )}

        {authView === 'signup' && (
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm text-foreground">Full Name</Label>
                <Input 
                  id="fullName" 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                  required 
                  placeholder="John Doe"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.fullName ? 'border-destructive' : ''}`}
                />
                {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm text-foreground">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  required 
                  placeholder="+1 (555) 000-0000"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.phone ? 'border-destructive' : ''}`}
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signupEmail" className="text-sm text-foreground">Email</Label>
                <Input 
                  id="signupEmail" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signupPassword" className="text-sm text-foreground">Password</Label>
                <Input 
                  id="signupPassword" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                  className={`h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary ${errors.password ? 'border-destructive' : ''}`}
                />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                {!errors.password && <p className="text-xs text-muted-foreground mt-1">Min 8 characters with uppercase, lowercase, and number</p>}
              </div>

              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-lg mt-6">
                Create Account
              </Button>
            </form>

            <button 
              type="button" 
              onClick={() => setAuthView('login')} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              Already have an account? <span className="text-foreground font-medium">Sign in</span>
            </button>
          </div>
        )}

        {authView === 'forgot-password' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter your email and we'll send you a link to reset your password.</p>
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="resetEmail" className="text-sm text-foreground">Email</Label>
                <Input 
                  id="resetEmail" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com"
                  className="h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            <button 
              type="button" 
              onClick={() => setAuthView('login')} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {authView === 'otp-request' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter your email and we'll send you a one-time code to sign in.</p>
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otpEmail" className="text-sm text-foreground">Email</Label>
                <Input 
                  id="otpEmail" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com"
                  className="h-12 bg-transparent border-0 border-b border-border rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
            <button 
              type="button" 
              onClick={() => setAuthView('login')} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {authView === 'otp-verify' && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to {email}</p>
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-lg" disabled={isSubmitting || otp.length !== 6}>
                {isSubmitting ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
            </form>
            <div className="text-center space-y-2">
              <button type="button" onClick={() => setAuthView('otp-request')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Resend code
              </button>
              <button type="button" onClick={() => setAuthView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full">
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
