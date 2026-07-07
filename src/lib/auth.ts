'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState & {
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
} {
  const { isLoading: configLoading } = useSupabaseConfig();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshSession = useCallback(async () => {
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data: { session } } = await supabase.auth.getSession();
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session,
      });
    } catch {
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    if (configLoading) return;

    refreshSession();

    let sub: ReturnType<import('@supabase/supabase-js').SupabaseClient['auth']['onAuthStateChange']> | null = null;

    (async () => {
      try {
        const supabase = await getSupabaseBrowserClientWithRetry();
        sub = supabase.auth.onAuthStateChange((_event, session) => {
          setState({
            user: session?.user ?? null,
            session,
            isLoading: false,
            isAuthenticated: !!session,
          });
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      sub?.data.subscription.unsubscribe();
    };
  }, [configLoading, refreshSession]);

  const logout = useCallback(async () => {
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      await supabase.auth.signOut();
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch {
      // ignore
    }
  }, []);

  return { ...state, logout, refreshSession };
}

/** 获取当前 session 的 access_token */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = await getSupabaseBrowserClientWithRetry();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
