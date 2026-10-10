/**
 * Who is signed in, and the token every authed request carries.
 *
 * The session is `{ token, user }`, persisted in `expo-secure-store` under
 * `ermi.token` and `ermi.user`. On mount the persisted token is re-checked
 * with `getMe`, so points are fresh and a revoked token signs the person out
 * rather than leaving a stale screen.
 *
 * Secure storage is unavailable on web; there the session simply lives in
 * memory for the tab, and every call is wrapped so that never crashes.
 */
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type RegisterInput,
  type User,
} from "@/api";

const TOKEN_KEY = "ermi.token";
const USER_KEY = "ermi.user";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  /** True while the persisted session is being restored on first mount. */
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-read the account (points, name) from the server. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persist(token: string | null, user: User | null): Promise<void> {
  try {
    if (token && user) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch {
    // Secure storage is optional (web). The in-memory session still works.
  }
}

async function restore(): Promise<{ token: string | null; user: User | null }> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return { token, user: raw ? (JSON.parse(raw) as User) : null };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await restore();
      if (cancelled) return;
      if (stored.token) {
        tokenRef.current = stored.token;
        setToken(stored.token);
        if (stored.user) setUser(stored.user);
        try {
          const fresh = await getMe(stored.token);
          if (cancelled) return;
          setUser(fresh);
          await persist(stored.token, fresh);
        } catch {
          if (cancelled) return;
          tokenRef.current = null;
          setToken(null);
          setUser(null);
          await persist(null, null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token: nextToken, user: nextUser } = await apiLogin(username.trim(), password);
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    await persist(nextToken, nextUser);
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    const { token: nextToken, user: nextUser } = await apiRegister(input);
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    await persist(nextToken, nextUser);
  }, []);

  const signOut = useCallback(async () => {
    const current = tokenRef.current;
    if (current) {
      try {
        await apiLogout(current);
      } catch {
        // The token may already be gone server-side; clearing locally is enough.
      }
    }
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    await persist(null, null);
  }, []);

  const refresh = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return;
    const fresh = await getMe(current);
    setUser(fresh);
    await persist(current, fresh);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, loading, signIn, signUp, signOut, refresh }),
    [token, user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
