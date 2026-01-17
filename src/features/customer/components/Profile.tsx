import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  full_name: string;
  phone: string;
  trust_score: string;
}

export const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    phone: '',
    trust_score: '0.0'
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          phone: data.phone || '',
          trust_score: data.trust_score?.toString() || '0.0'
        });
      }
    };

    fetchProfile();
  }, [user]);

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold text-center mb-4 text-card-foreground">My Profile</h2>
      <p className="text-sm text-center text-muted-foreground mb-6">Your account & preferences</p>
      
      <div className="bg-card rounded-2xl p-4 flex items-center gap-4 mb-4">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-4xl">person</span>
        </div>
        <div className="flex-grow">
          <p className="text-lg font-bold text-card-foreground">{profile.full_name}</p>
          <p className="text-sm text-muted-foreground">{profile.phone}</p>
          <Button variant="secondary" size="sm" className="mt-2">
            <span className="material-symbols-outlined text-base mr-2">edit</span>
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 space-y-2 mb-4">
        <h2 className="text-lg font-bold text-card-foreground mb-4">Account Settings</h2>
        
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">shield</span>
            </div>
            <p className="text-base text-foreground">Trust Score</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-yellow-400">{profile.trust_score}</p>
            <span className="material-symbols-outlined text-lg text-yellow-400">star</span>
          </div>
        </div>

        <div className="flex items-center gap-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <span className="material-symbols-outlined">credit_card</span>
          </div>
          <p className="text-base text-foreground">Payment Methods</p>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <span className="material-symbols-outlined">group</span>
            </div>
            <p className="text-base text-foreground">Referral Code</p>
          </div>
          <Button variant="secondary" size="sm">
            <span className="material-symbols-outlined text-base mr-2">share</span>
            Share
          </Button>
        </div>

        <div className="flex items-center gap-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <span className="material-symbols-outlined">lock</span>
          </div>
          <p className="text-base text-foreground">Privacy & Security</p>
        </div>
      </div>

      <div className="px-4 py-3">
        <Button variant="default" className="w-full" onClick={signOut}>
          Log Out
        </Button>
      </div>
    </section>
  );
};
