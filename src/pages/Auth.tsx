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
  fullName: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  phone: z.string()
    .trim()
    .regex(/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Invalid phone number format'),
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

const signInSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required'),
});

type AuthView = 'login' | 'signup' | 'forgot-password' | 'otp-request' | 'otp-verify';

export default function Auth() {
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
    const checkUserAndRedirect = async () => {
      if (user && !loading) {
        const { data: barber } = await supabase
          .from('barbers')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        if (barber) {
          navigate('/salon-dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    };
    checkUserAndRedirect();
  }, [user, loading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } else {
        toast({
          title: 'Email Sent',
          description: 'Check your inbox for the password reset link.',
        });
        setAuthView('login');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } else {
        toast({
          title: 'OTP Sent',
          description: 'Check your email for the verification code.',
        });
        setAuthView('otp-verify');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'email',
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      } else {
        toast({
          title: 'Success',
          description: 'You have been signed in successfully.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
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
        await signUp(
          validatedData.email, 
          validatedData.password, 
          validatedData.fullName, 
          validatedData.phone
        );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        
        const firstError = error.errors[0];
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: firstError.message,
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B] p-4" style={{ background: 'radial-gradient(ellipse at center, #1a1a1a 0%, #0B0B0B 70%)' }}>
      <div className="w-full max-w-sm">
        <div className="px-6 py-8">
          {/* Brand Title */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold italic text-white leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              Make My<br />Cut
            </h1>
            <p className="text-base text-muted-foreground mt-3 italic" style={{ fontFamily: 'Playfair Display, serif' }}>
              Your Style. Your Time.
            </p>
          </div>

          {/* Login View */}
          {authView === 'login' && (
            <>
              {/* Google Button */}
              <Button
                type="button"
                variant="secondary"
                className="w-full h-12 text-base rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white border-0"
                onClick={signInWithGoogle}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </Button>

              {/* OR Divider */}
              <div className="relative my-6">
                <Separator className="bg-[#333]" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0B0B0B] px-3 text-xs text-muted-foreground">
                  OR
                </span>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    required
                    placeholder="name@example.com"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.email ? 'border-destructive' : ''}`}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                    }}
                    required
                    placeholder="••••••••"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.password ? 'border-destructive' : ''}`}
                  />
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full h-12 rounded-lg bg-[#6B2C2C] hover:bg-[#7d3434] text-white text-base font-medium mt-2">
                  Step Inside
                </Button>
              </form>

              {/* Secondary Links */}
              <div className="mt-6 space-y-3 text-center">
                <button
                  type="button"
                  onClick={() => setAuthView('forgot-password')}
                  className="text-sm text-muted-foreground hover:text-white transition-colors w-full"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setAuthView('signup')}
                  className="text-sm text-muted-foreground hover:text-white transition-colors w-full"
                >
                  Don't have an account? <span className="text-white underline">Sign up</span>
                </button>
              </div>
            </>
          )}

          {/* Signup View */}
          {authView === 'signup' && (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="fullName" className="text-sm text-muted-foreground">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                    }}
                    required
                    placeholder="John Doe"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.fullName ? 'border-destructive' : ''}`}
                  />
                  {errors.fullName && <p className="text-xs text-destructive mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm text-muted-foreground">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    required
                    placeholder="+1 (555) 000-0000"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.phone ? 'border-destructive' : ''}`}
                  />
                  {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="signupEmail" className="text-sm text-muted-foreground">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    required
                    placeholder="name@example.com"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.email ? 'border-destructive' : ''}`}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="signupPassword" className="text-sm text-muted-foreground">Password</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                    }}
                    required
                    placeholder="••••••••"
                    className={`bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground ${errors.password ? 'border-destructive' : ''}`}
                  />
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                  {!errors.password && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Min 8 characters with uppercase, lowercase, and number
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full h-12 rounded-lg bg-[#6B2C2C] hover:bg-[#7d3434] text-white text-base font-medium">
                  Create Account
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="text-sm text-muted-foreground hover:text-white transition-colors w-full text-center mt-6"
              >
                Already have an account? <span className="text-primary">Sign in</span>
              </button>
            </>
          )}

          {/* Forgot Password View */}
          {authView === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <div>
                <Label htmlFor="resetEmail" className="text-sm text-muted-foreground">Email</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" className="w-full h-12 rounded-lg bg-[#6B2C2C] hover:bg-[#7d3434] text-white text-base font-medium" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="text-sm text-muted-foreground hover:text-white transition-colors w-full text-center"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* OTP Request View */}
          {authView === 'otp-request' && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter your email and we'll send you a one-time code to sign in.
              </p>
              <div>
                <Label htmlFor="otpEmail" className="text-sm text-muted-foreground">Email</Label>
                <Input
                  id="otpEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="bg-transparent border-0 border-b border-[#444] rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary text-white placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" className="w-full h-12 rounded-lg bg-[#6B2C2C] hover:bg-[#7d3434] text-white text-base font-medium" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </Button>
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="text-sm text-muted-foreground hover:text-white transition-colors w-full text-center"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* OTP Verify View */}
          {authView === 'otp-verify' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter the 6-digit code sent to {email}
              </p>
              <div className="flex justify-center">
                <InputOTP
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  maxLength={6}
                >
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
              <Button type="submit" className="w-full h-12 rounded-lg bg-[#6B2C2C] hover:bg-[#7d3434] text-white text-base font-medium" disabled={isSubmitting || otp.length !== 6}>
                {isSubmitting ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={handleSendOTP}
                  className="text-sm text-muted-foreground hover:text-white transition-colors"
                  disabled={isSubmitting}
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtp('');
                    setAuthView('otp-request');
                  }}
                  className="text-sm text-muted-foreground hover:text-white transition-colors w-full"
                >
                  Change Email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}