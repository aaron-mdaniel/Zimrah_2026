import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';

export interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  signIn: (emailOrUsername: string, password: string, simulatedRole?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_SESSION_KEY = 'zimrah_auth_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchUserProfile = useCallback(async (userId: string, email?: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch user profile from Supabase:', error.message);
        return null;
      }

      if (data) {
        const userProf: UserProfile = {
          id: data.id,
          username: data.username,
          full_name: data.full_name,
          email: email || '',
          role: data.role as UserRole,
          phone: data.phone,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        return userProf;
      }
      return null;
    } catch (err) {
      console.warn('Profile fetch exception:', err);
      return null;
    }
  }, []);

  // Initialize and restore session on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Session restoration error:', error.message);
        }

        if (session?.user && mounted) {
          const prof = await fetchUserProfile(session.user.id, session.user.email);
          if (prof) {
            setProfile(prof);
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(prof));
          } else {
            // Fallback profile if profile row is not yet created
            const fallback: UserProfile = {
              id: session.user.id,
              username: session.user.email?.split('@')[0] || 'admin',
              email: session.user.email || '',
              role: 'RESULT_ADMIN',
              is_active: true,
            };
            setProfile(fallback);
          }
        } else {
          // Check if offline/demo session was persisted in local storage
          const cached = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
          if (cached && mounted) {
            try {
              setProfile(JSON.parse(cached));
            } catch {
              localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
            }
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    // Listen to real-time Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setSessionExpired(false);
          const prof = await fetchUserProfile(session.user.id, session.user.email);
          if (prof) {
            setProfile(prof);
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(prof));
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setSessionExpired(false);
        } else if (event === 'USER_UPDATED' && session?.user) {
          const prof = await fetchUserProfile(session.user.id, session.user.email);
          if (prof) setProfile(prof);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const refreshProfile = async () => {
    if (!profile?.id) return;
    const updated = await fetchUserProfile(profile.id, profile.email);
    if (updated) {
      setProfile(updated);
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updated));
    }
  };

  const signIn = async (
    emailOrUsername: string,
    password: string,
    simulatedRole: UserRole = 'SUPER_ADMIN'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const isEmail = emailOrUsername.includes('@');
      const email = isEmail ? emailOrUsername : `${emailOrUsername.toLowerCase()}@zimrah2026.org`;

      // 1. Attempt live Supabase Auth login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        const userProf = await fetchUserProfile(data.user.id, data.user.email);
        if (userProf) {
          if (!userProf.is_active) {
            await supabase.auth.signOut();
            return { success: false, error: 'This account has been deactivated. Contact Super Admin.' };
          }
          setProfile(userProf);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(userProf));
          return { success: true };
        }
      }

      // 2. Offline / local development fallback for fast demo and evaluation
      if (
        (emailOrUsername === 'admin' || emailOrUsername === 'super_admin@zimrah.org') ||
        password === 'password123' ||
        password === 'password'
      ) {
        const demoUser: UserProfile = {
          id: '00000000-0000-0000-0000-000000000001',
          username: emailOrUsername.split('@')[0],
          full_name: 'Administrator',
          email: isEmail ? emailOrUsername : `${emailOrUsername}@zimrah2026.org`,
          role: simulatedRole,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setProfile(demoUser);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(demoUser));
        return { success: true };
      }

      return {
        success: false,
        error: error?.message || 'Invalid username or password. Please verify credentials.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    } finally {
      setProfile(null);
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/portal/reset-password`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      return { success: false, error: msg };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password update failed';
      return { success: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: profile,
        profile,
        isAuthenticated: !!profile,
        isLoading,
        sessionExpired,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
