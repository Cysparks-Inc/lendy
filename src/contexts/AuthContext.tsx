import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const isFetching = useRef(false);

  const isSuperAdmin = userRole === 'super_admin';
  const isBranchAdmin = userRole === 'branch_admin';
  const isStaff = ['super_admin', 'branch_admin', 'loan_officer', 'teller'].includes(userRole || '');

  const fetchUserRoleAndProfile = async (userId: string): Promise<{ role: string | null; profile: any | null }> => {
    try {
      console.log('Fetching profile for user:', userId);
      // Create a timeout wrapper for the profile fetch
      const timeoutPromise = new Promise<{ role: string | null; profile: any | null }>((resolve) => 
        setTimeout(() => {
          console.log('Profile fetch timeout - returning default');
          resolve({ role: 'teller', profile: null });
        }, 3000)
      );
      
      // Create the actual query promise
      const queryPromise = async () => {
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
      };
      
      // Race the timeout against the actual query
      const result = await Promise.race([
        queryPromise(),
        timeoutPromise
      ]);
      
      console.log('Profile fetch completed:', result?.role);
      return result;
    } catch (error) {
      console.error('Error fetching user role and profile:', error);
      return { role: null, profile: null };
    }
  };

  const fetchUserPermissions = async (userId: string): Promise<Permission[]> => {
    try {
      // Create a timeout promise that returns empty array instead of rejecting
      const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: null }), 2000)
      );
      
      // Create the query promise
      const queryPromise = supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);
      
      // Race against timeout
      const result = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;
      
      if (result.error) {
        // Silently fail if table doesn't exist or there's an error
        return [];
      }
      
      if (!result.data || result.data.length === 0) {
        return [];
      }
      
      return result.data.map((p: any) => p.permission as Permission);
    } catch (error) {
      // Silently fail - permission table may not exist
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
    let mounted = true;
    let loadingTimer: NodeJS.Timeout | null = null;
    
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout triggered - forcing loading to false');
      if (mounted) {
        setLoading(false);
      }
    }, 5000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth event:', event, 'User:', session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Don't refetch profile on TOKEN_REFRESHED - data hasn't changed
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed - skipping data refetch');
          clearTimeout(safetyTimeout);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        if (session?.user) {
          // Only fetch on INITIAL_SESSION to avoid duplicate calls
          // INITIAL_SESSION fires on page reload and handles everything
          if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            if (!isFetching.current) {
              isFetching.current = true;
              console.log('Starting fetch for event:', event);
              try {
                console.log('Calling fetchUserRoleAndProfile...');
                const rolePromise = fetchUserRoleAndProfile(session.user.id);
                console.log('Calling fetchUserPermissions...');
                const permPromise = fetchUserPermissions(session.user.id);
                console.log('Waiting for Promise.all...');
                const [{ role, profile: userProfile }, userPermissions] = await Promise.all([
                  rolePromise,
                  permPromise
                ]);
                console.log('Promise.all completed! Data:', { role, profile: userProfile?.full_name, permissions: userPermissions.length });
                if (mounted) {
                  setUserRole(role);
                  setProfile(userProfile);
                  setPermissions(userPermissions);
                }
              } catch (error) {
                console.error('Error in Promise.all:', error);
              } finally {
                console.log('Finally block - resetting isFetching');
                isFetching.current = false;
              }
            } else {
              console.log('Already fetching, skipping duplicate request');
            }
          } else if (event === 'SIGNED_IN') {
            // For SIGNED_IN, just ensure we have data loaded (quick fetch without hanging)
            console.log('SIGNED_IN event - will load via INITIAL_SESSION');
            if (!isFetching.current && !profile) {
              // Only fetch if we don't have profile yet
              isFetching.current = true;
              fetchUserRoleAndProfile(session.user.id).then(({ role, profile: userProfile }) => {
                fetchUserPermissions(session.user.id).then((userPermissions) => {
                  if (mounted) {
                    setUserRole(role);
                    setProfile(userProfile);
                    setPermissions(userPermissions);
                  }
                  isFetching.current = false;
                });
              });
            }
          }
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

        clearTimeout(safetyTimeout);
        if (mounted) {
          setLoading(false);
        }
      }
    );

    // Set loading to false immediately for INITIAL_SESSION events from the listener
    // The listener handles everything including page reloads

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
      subscription.unsubscribe();
    };
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