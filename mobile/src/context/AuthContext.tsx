import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginRequest, registerPushToken } from '../api/client';
import { registerExpoPushToken } from '../services/pushNotifications';

const TOKEN_KEY = 'sborka_jwt';

type AuthContextValue = {
  token: string | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const syncPushToken = useCallback(async (jwtToken: string) => {
    try {
      const expoToken = await registerExpoPushToken();
      if (!expoToken) return;
      await registerPushToken(jwtToken, expoToken);
    } catch (err) {
      console.log('[push] register token failed', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!cancelled) {
          setToken(stored);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    syncPushToken(token);
  }, [token, syncPushToken]);

  const login = useCallback(async (login: string, password: string) => {
    const res = await loginRequest(login, password);
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      ready,
      login,
      logout,
    }),
    [token, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth вне AuthProvider');
  }
  return ctx;
}
