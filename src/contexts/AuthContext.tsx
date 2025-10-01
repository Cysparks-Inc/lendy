import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Permission } from '@/config/permissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  profile: any | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isBranchAdmin: boolean;
  isStaff: boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshPermissions: () => Promise<void>;
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
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = userRole === 'super_admin';
  const isBranchAdmin = userRole === 'branch_admin';
  const isStaff = ['super_admin', 'branch_admin', 'loan_officer', 'teller'].includes(userRole || '');

  const fetchUserRoleAndProfile = async (userId: string): Promise<{ role: string | null; profile: any | null }> => {
    try {
      // Fetch profile which contains both role and other profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, branch_id, is_active, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
        return { role: null, profile: null };
      }
      
      if (!profileData) {
        return { role: null, profile: null };
      }
      
      // Check if user is active
      if (profileData.is_active === false) {
        await supabase.auth.signOut();
        toast.error('Account Deactivated', {
          description: 'Your account has been deactivated. Please contact an administrator.',
        });
        return { role: null, profile: null };
      }
      
      return {
        role: profileData.role || 'teller', // Default to teller if no role
        profile: profileData
      };
    } catch (error) {
      console.error('Error fetching user role and profile:', error);
      return { role: null, profile: null };
    }
  };

  const fetchUserPermissions = async (userId: string): Promise<Permission[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);
      
      if (error) {
        return [];
      }
      
      return data?.map((p: any) => p.permission as Permission) || [];
    } catch (error) {
      return [];
    }
  };

  const refreshPermissions = async () => {
    if (user?.id) {
      const userPermissions = await fetchUserPermissions(user.id);
      setPermissions(userPermissions);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role, profile, and permissions after setting user
          setTimeout(async () => {
            const { role, profile: userProfile } = await fetchUserRoleAndProfile(session.user.id);
            const userPermissions = await fetchUserPermissions(session.user.id);
            setUserRole(role);
            setProfile(userProfile);
            setPermissions(userPermissions);
          }, 0);
        } else {
          setUserRole(null);
          setProfile(null);
          setPermissions([]);
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
        Promise.all([
          fetchUserRoleAndProfile(session.user.id),
          fetchUserPermissions(session.user.id)
        ]).then(([{ role, profile: userProfile }, userPermissions]) => {
          setUserRole(role);
          setProfile(userProfile);
          setPermissions(userPermissions);
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

  const hasPermission = (permission: Permission): boolean => {
    // Super admin always has all permissions
    if (isSuperAdmin) return true;
    // Check if user has the specific permission
    return permissions.includes(permission);
  };

  const value: AuthContextType = {
    user,
    session,
    userRole,
    profile,
    permissions,
    loading,
    signIn,
    signOut,
    isSuperAdmin,
    isBranchAdmin,
    isStaff,
    hasPermission,
    refreshPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};