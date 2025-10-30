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
  const isStaff = ['super_admin', 'admin', 'branch_admin', 'loan_officer', 'auditor'].includes(userRole || '');

  /**
   * Fetch user profile and role from the database.
   * Avoids fallbacks that could mislabel users (e.g., showing Admin as Loan Officer).
   */
  const fetchUserRoleAndProfile = async (userId: string): Promise<{ role: string | null; profile: any | null }> => {
    try {
      // Original fast path that never blocked the UI
      const timeoutPromise = new Promise<{ role: string | null; profile: any | null }>((resolve) => 
        setTimeout(() => resolve({ role: 'teller', profile: null }), 3000)
      );
      const queryPromise = async () => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, role, full_name, branch_id, is_active, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle();
        if (profileError && profileError.code !== 'PGRST116') {
          return { role: null, profile: null };
        }
        if (!profileData) {
          return { role: null, profile: null };
        }
        if (profileData.is_active === false) {
          await supabase.auth.signOut();
          toast.error('Account Deactivated', { description: 'Your account has been deactivated. Please contact an administrator.' });
          return { role: null, profile: null };
        }
        return { role: profileData.role || 'teller', profile: profileData };
      };
      return await Promise.race([queryPromise(), timeoutPromise]);
    } catch {
      return { role: null, profile: null };
    }
  };

  /**
   * Fetches user-specific permissions from database with timeout protection
   * Returns empty array on timeout or error (graceful degradation)
   */
  const fetchUserPermissions = async (userId: string): Promise<Permission[]> => {
    try {
      // Timeout protection - returns empty array after 2 seconds
      const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: null }), 2000)
      );
      
      const queryPromise = supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', userId);
      
      const result = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (result.error || !result.data || result.data.length === 0) {
        return [];
      }
      
      return result.data.map((p: any) => p.permission as Permission);
    } catch (error) {
      // Graceful failure - permission table may not exist yet
      return [];
    }
  };

  /**
   * Public method to refresh user permissions (called when permissions change)
   */
  const refreshPermissions = async () => {
    if (user?.id) {
      const userPermissions = await fetchUserPermissions(user.id);
      setPermissions(userPermissions);
    }
  };

  useEffect(() => {
    let mounted = true;
    let loadingTimer: NodeJS.Timeout | null = null;
    
    // Safety mechanism: force loading to false after 5 seconds to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 5000);

    // Listen to authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Token refresh doesn't change user data - skip refetch
        if (event === 'TOKEN_REFRESHED') {
          clearTimeout(safetyTimeout);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        if (session?.user) {
          // Fetch user data only on initial session or user updates
          if (event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
            // Prevent duplicate fetches with ref flag
            if (!isFetching.current) {
              isFetching.current = true;
              try {
                // Fetch role and permissions in parallel for better performance
                const [{ role, profile: userProfile }, userPermissions] = await Promise.all([
                  fetchUserRoleAndProfile(session.user.id),
                  fetchUserPermissions(session.user.id)
                ]);
                
                if (mounted) {
                  setUserRole(role);
                  setProfile(userProfile);
                  setPermissions(userPermissions);
                }
              } catch (error) {
                // Error already handled in fetch functions
              } finally {
                isFetching.current = false;
              }
            }
          } else if (event === 'SIGNED_IN') {
            // Fire-and-forget login log; do not block UI
            try { supabase.functions.invoke('log-auth-event', { body: { event_type: 'login', user_id: session.user.id } } as any); } catch {}
            // SIGNED_IN is followed by INITIAL_SESSION, so only fetch if no profile exists
            if (!isFetching.current && !profile) {
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
          // User signed out - clear all data
          setUserRole(null);
          setProfile(null);
          setPermissions([]);
        }
        
        // Clean up MFA verification flags on sign out
        if (event === 'SIGNED_OUT') {
          try { supabase.functions.invoke('log-auth-event', { body: { event_type: 'logout' } } as any); } catch {}
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

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  // Lightweight presence updates that don't block UI
  useEffect(() => {
    if (!user) return;
    let timer: any;
    const setOnline = () => { try { void supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() } as any).eq('id', user.id); } catch {} };
    const setOffline = () => { try { void supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() } as any).eq('id', user.id); } catch {} };
    setOnline();
    timer = setInterval(setOnline, 120 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') setOnline(); else setOffline(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); setOffline(); };
  }, [user?.id]);

  /**
   * Sign in with email and password
   */
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

  /**
   * Sign out current user and clear MFA flags
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
        throw error;
      }
      
      // Clear MFA verification flag for this user
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

  /**
   * Check if user has a specific permission
   * Super admins and admins always have all permissions
   */
  const hasPermission = (permission: Permission): boolean => {
    if (userRole === 'super_admin' || userRole === 'admin') return true;
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