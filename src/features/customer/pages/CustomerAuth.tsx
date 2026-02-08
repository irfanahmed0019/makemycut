import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  phone: z.string().trim().regex(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Invalid phone number format'),
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
});
const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required')
});
type AuthView = 'login' | 'signup' | 'forgot-password' | 'otp-request' | 'otp-verify' | 'signup-otp-verify';
export default function CustomerAuth() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    signIn,
    signUp,
    signInWithGoogle,
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Role-based routing after authentication
  useEffect(() => {
    const handleRoleBasedRedirect = async () => {
      if (!user || loading) return;

      // Check if user is a salon owner (has a barber shop)
      const {
        data: barberData
      } = await supabase.from('barbers').select('id').eq('owner_id', user.id).maybeSingle();
      if (barberData) {
        // Salon owner - redirect to dashboard
        navigate('/salon-dashboard', {
          replace: true
        });
      } else {
        // Customer - redirect to home
        navigate('/', {
          replace: true
        });
      }
    };
    handleRoleBasedRedirect();
  }, [user, loading, navigate]);
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message
        });
      } else {
        toast({
          title: 'Email Sent',
          description: 'Check your inbox for the password reset link.'
        });
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
      const {
        error
      } = await supabase.auth.signInWithOtp({
        email: email.trim()
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message
        });
      } else {
        toast({
          title: 'OTP Sent',
          description: 'Check your email for the verification code.'
        });
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
      const {
        error
      } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'email'
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message
        });
      } else {
        toast({
          title: 'Success',
          description: 'You have been signed in successfully.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      if (authView === 'login') {
        const validatedData = signInSchema.parse({
          email,
          password
        });
        await signIn(validatedData.email, validatedData.password);
      } else if (authView === 'signup') {
        const validatedData = signUpSchema.parse({
          fullName,
          phone,
          email,
          password
        });
        const {
          error
        } = await signUp(validatedData.email, validatedData.password, validatedData.fullName, validatedData.phone);
        if (!error) {
          // Move to OTP verification after successful signup
          setAuthView('signup-otp-verify');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: error.errors[0].message
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleVerifySignupOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const {
        error
      } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'signup'
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message
        });
      } else {
        toast({
          title: 'Welcome!',
          description: 'Your account has been verified successfully.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleResendOTP = async () => {
    setIsSubmitting(true);
    try {
      const {
        error
      } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message
        });
      } else {
        toast({
          title: 'OTP Resent',
          description: 'Check your email for the new verification code.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>;
  }
  return <div className="min-h-screen flex flex-col justify-center bg-gradient-to-b from-[#0B0B0B] to-[#121212] px-6 py-12">
      <div className="w-full max-w-sm mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-6xl font-semibold italic leading-[1.1] tracking-tight text-primary-foreground">
            Make My<br />Cut
          </h1>
          <p className="text-[#A0A0A0] mt-4 text-base tracking-wide italic font-sans">
            Your Style. Your Time.
          </p>
        </div>

        {authView === 'login' && <div className="space-y-6">
            {/* Google Button - Light neutral background */}
            <Button type="button" variant="outline" className="w-full h-14 text-base font-medium bg-[#F5F5F5] text-[#1A1A1A] hover:bg-[#E8E8E8] border-0 rounded-2xl shadow-sm" onClick={signInWithGoogle}>
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            {/* Subtle Divider */}
            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#1F1F1F]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#0B0B0B] px-4 text-[#A0A0A0] uppercase tracking-wider">OR</span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-white">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={`h-12 bg-transparent border-0 border-b border-[#1F1F1F] rounded-none px-0 text-white placeholder:text-[#A0A0A0] focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.email ? 'border-destructive' : ''}`} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className={`h-12 bg-transparent border-0 border-b border-[#1F1F1F] rounded-none px-0 text-white placeholder:text-[#A0A0A0] focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.password ? 'border-destructive' : ''}`} />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-base font-semibold rounded-xl bg-[#9E2A2B] hover:bg-[#B02A2A] text-white shadow-lg shadow-[#9E2A2B]/20">
                {isSubmitting ? 'Signing in...' : 'Step Inside'}
              </Button>
            </form>

            {/* Footer Link - Subtle */}
            <div className="text-center pt-2">
              <button type="button" onClick={() => setAuthView('signup')} className="text-sm text-[#A0A0A0] hover:text-white transition-colors">
                Don't have an account? <span className="text-white font-medium">Sign up</span>
              </button>
            </div>
          </div>}

        {authView === 'signup' && <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <Label htmlFor="fullName" className="text-sm font-medium text-foreground">Full Name</Label>
                <Input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Doe" className={`h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.fullName ? 'border-destructive' : ''}`} />
                {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone Number</Label>
                <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+1 (555) 000-0000" className={`h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.phone ? 'border-destructive' : ''}`} />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="signupEmail" className="text-sm font-medium text-foreground">Email</Label>
                <Input id="signupEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={`h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.email ? 'border-destructive' : ''}`} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="signupPassword" className="text-sm font-medium text-foreground">Password</Label>
                <Input id="signupPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className={`h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors ${errors.password ? 'border-destructive' : ''}`} />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                {!errors.password && <p className="text-xs text-muted-foreground mt-1">Min 8 characters with uppercase, lowercase, and number</p>}
              </div>

              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl mt-2 shadow-lg shadow-primary/20">
                Create Account
              </Button>
            </form>

            <button type="button" onClick={() => setAuthView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
              Already have an account? <span className="text-foreground font-medium">Sign in</span>
            </button>
          </div>}

        {authView === 'forgot-password' && <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter your email and we'll send you a link to reset your password.</p>
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1">
                <Label htmlFor="resetEmail" className="text-sm font-medium text-foreground">Email</Label>
                <Input id="resetEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors" />
              </div>
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            <button type="button" onClick={() => setAuthView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
              Back to Sign In
            </button>
          </div>}

        {authView === 'otp-request' && <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter your email and we'll send you a one-time code to sign in.</p>
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div className="space-y-1">
                <Label htmlFor="otpEmail" className="text-sm font-medium text-foreground">Email</Label>
                <Input id="otpEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="h-12 bg-transparent border-0 border-b border-[hsl(0,0%,12%)] rounded-none px-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary transition-colors" />
              </div>
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
            <button type="button" onClick={() => setAuthView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center">
              Back to Sign In
            </button>
          </div>}

        {authView === 'otp-verify' && <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to {email}</p>
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={value => setOtp(value)}>
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
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting || otp.length !== 6}>
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
          </div>}

        {authView === 'signup-otp-verify' && <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">Verify your email</h2>
              <p className="text-sm text-muted-foreground">
                We've sent a 6-digit code to<br />
                <span className="text-foreground font-medium">{email}</span>
              </p>
            </div>
            
            <form onSubmit={handleVerifySignupOTP} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={value => setOtp(value)}>
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-xl border-[hsl(0,0%,12%)] bg-transparent rounded-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              <Button type="submit" className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting || otp.length !== 6}>
                {isSubmitting ? 'Verifying...' : 'Join MakeMyCut'}
              </Button>
            </form>
            
            <div className="text-center space-y-3">
              <button type="button" onClick={handleResendOTP} disabled={isSubmitting} className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                Didn't receive the code? <span className="text-primary font-medium">Resend</span>
              </button>
              <button type="button" onClick={() => {
            setAuthView('signup');
            setOtp('');
          }} className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full">
                ← Back to Sign Up
              </button>
            </div>
          </div>}
      </div>
    </div>;
}