import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clearRoleCache } from '@/hooks/useUserRole';
import { reportError } from '@/lib/monitoring';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser((prev) => {
          const next = session?.user ?? null;
          // Keep the same object identity across token refreshes so consumers
          // don't re-run effects (and flash loading skeletons) every refresh.
          if (prev && next && prev.id === next.id) return prev;
          return next;
        });
        if (event === 'SIGNED_OUT') clearRoleCache();
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser((prev) => {
        const next = session?.user ?? null;
        if (prev && next && prev.id === next.id) return prev;
        return next;
      });
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Timeout fallback to ensure loading state doesn't hang
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message
      });
      return { error };
    } else {
      toast({
        title: "Almost there!",
        description: "Check your email for the verification code."
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) reportError('auth', error, { action: 'signInWithPassword' });

    // NOTE: the caller decides how to surface the failure (salon vs customer
    // login show different guidance), so we do not toast here — that produced
    // duplicate/misleading "Sign in failed" toasts.
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Google sign in failed",
        description: error.message
      });
    }

    return { error };
  };

  const signOut = async () => {
    // Always clear the local session first. A stale/expired refresh token makes
    // the server return 403 "Session not found", which must not block logout.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* ignore — local state is cleared below regardless */
    }
    clearRoleCache();
    try { sessionStorage.clear(); } catch { /* ignore */ }
    setSession(null);
    setUser(null);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
  };

  return (
    <AuthContext.Provider value={{ user, session, signUp, signIn, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
