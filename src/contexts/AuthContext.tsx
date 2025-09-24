import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  profile: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isBranchAdmin: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = userRole === 'super_admin';
  const isBranchAdmin = userRole === 'branch_admin';
  const isStaff = ['super_admin', 'branch_admin', 'loan_officer', 'teller'].includes(userRole || '');

  const fetchUserRoleAndProfile = async (userId: string): Promise<{ role: string | null; profile: any | null }> => {
    try {
      // Fetch profile which contains both role and other profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
      }
      
      // Check if user is active
      if (profileData && !(profileData as any).is_active) {
        console.log('User is inactive, signing out...');
        await supabase.auth.signOut();
        toast.error('Account Deactivated', {
          description: 'Your account has been deactivated. Please contact an administrator.',
        });
        return { role: null, profile: null };
      }
      
      return {
        role: (profileData as any)?.role || null,
        profile: profileData || null
      };
    } catch (error) {
      console.error('Error fetching user role and profile:', error);
      return { role: null, profile: null };
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role and profile after setting user
          setTimeout(async () => {
            const { role, profile: userProfile } = await fetchUserRoleAndProfile(session.user.id);
            setUserRole(role);
            setProfile(userProfile);
          }, 0);
        } else {
          setUserRole(null);
          setProfile(null);
        }
        
        // If we're signed out by any means, ensure MFA flags are cleared
        if (event === 'SIGNED_OUT') {
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('mfa_verified_')) keysToRemove.push(k);
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          } catch {}
        }

        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRoleAndProfile(session.user.id).then(({ role, profile: userProfile }) => {
          setUserRole(role);
          setProfile(userProfile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      toast.success('Successfully signed in');
      return {};
    } catch (error) {
      toast.error('An unexpected error occurred');
      return { error };
    }
  };


  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        throw error;
      }
      // Clear any MFA verified flags for this user
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data?.session?.user?.id;
        if (userId) {
          localStorage.removeItem(`mfa_verified_${userId}`);
        }
      } catch {}
      toast.success('Successfully signed out');
    } catch (error) {
      toast.error('Error signing out');
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userRole,
    profile,
    loading,
    signIn,
    signOut,
    isSuperAdmin,
    isBranchAdmin,
    isStaff,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};