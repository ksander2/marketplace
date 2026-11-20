import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from "@marketplace/contracts/auth";
import * as authApi from "../api/auth";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isRestoring: boolean;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCESS_TOKEN_KEY = "marketplace.accessToken";
const REFRESH_TOKEN_KEY = "marketplace.refreshToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    () => localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  const [isRestoring, setIsRestoring] = useState(() => Boolean(refreshToken));

  const saveSession = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setAccessToken(response.accessToken);
    setRefreshToken(response.refreshToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }, []);

  useEffect(() => {
    if (!refreshToken) return;

    authApi
      .refresh(refreshToken)
      .then(saveSession)
      .catch(clearSession)
      .finally(() => setIsRestoring(false));
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    saveSession(await authApi.login(input));
  }, [saveSession]);

  const register = useCallback(async (input: RegisterRequest) => {
    saveSession(await authApi.register(input));
  }, [saveSession]);

  const logout = useCallback(async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    clearSession();
  }, [refreshToken, clearSession]);

  const value = useMemo(
    () => ({ user, accessToken, isRestoring, login, register, logout }),
    [user, accessToken, isRestoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
