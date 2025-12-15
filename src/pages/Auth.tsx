import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
];

const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Format as: XXXXX XXXXX (for 10 digits)
  if (digits.length <= 5) {
    return digits;
  } else if (digits.length <= 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
};

type AuthView = 'otp-request' | 'otp-verify';

export default function Auth() {
  const [authView, setAuthView] = useState<AuthView>('otp-request');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading } = useAuth();
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

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Format phone number with country code
    const digitsOnly = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode}${digitsOnly}`;
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
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
          description: 'Check your phone for the verification code.',
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
    
    const digitsOnly = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode}${digitsOnly}`;
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-2 text-card-foreground" style={{ fontFamily: 'serif' }}>
              Make My Cut
            </h1>
            <p className="text-lg text-muted-foreground" style={{ fontFamily: 'serif' }}>
              Your Style. Your Time.
            </p>
          </div>

          {/* OTP Request View */}
          {authView === 'otp-request' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter your phone number and we'll send you a one-time code to sign in.
              </p>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[120px] bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border z-50">
                      {countryCodes.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.code}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    required
                    placeholder="98765 43210"
                    className="flex-1"
                    maxLength={11}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
          )}

          {/* OTP Verify View */}
          {authView === 'otp-verify' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Enter the 6-digit code sent to {countryCode} {phone}
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(value) => setOtp(value)}
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
              <Button type="submit" className="w-full" disabled={isSubmitting || otp.length !== 6}>
                {isSubmitting ? 'Verifying...' : 'Verify OTP'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setAuthView('otp-request');
                  setOtp('');
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-full text-center"
              >
                Change Phone Number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
