/**
 * Auth Context Provider
 * Provides authentication state to the entire app
 */

"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  createContext,
  ReactNode,
} from "react";
import {
  apiClient,
  AuthState,
  getStoredUser,
  getAuthToken,
} from "@/lib/api-client";

export interface UseAuthReturn {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: AuthState["user"] | null;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  googleAuth: (credential: string) => Promise<boolean>;
  logout: () => Promise<void>;
  error: string | null;
}

/**
 * Auth Context
 */
const AuthContext = createContext<UseAuthReturn | undefined>(undefined);

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<AuthState["user"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getAuthToken();

    if (storedUser && token) {
      setUser(storedUser);
      setIsLoggedIn(true);
    }
  }, []);

  // Listen for token-refresh failures dispatched by apiRequest (AUTH-03)
  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
      setIsLoggedIn(false);
    };
    window.addEventListener("auth:logout", handleAuthLogout);
    return () => window.removeEventListener("auth:logout", handleAuthLogout);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.auth.register(email, password, name);

        if (response.success && response.data) {
          setUser(response.data.user);
          setIsLoggedIn(true);
          return true;
        } else {
          const errorMsg = response.error || "Registration failed";
          setError(errorMsg);
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.auth.login(email, password);

        if (response.success && response.data) {
          setUser(response.data.user);
          setIsLoggedIn(true);
          return true;
        } else {
          const errorMsg = response.error || "Login failed";
          setError(errorMsg);
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const googleAuth = useCallback(
    async (credential: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.auth.googleAuth(credential);

        if (response.success && response.data) {
          setUser(response.data.user);
          setIsLoggedIn(true);
          return true;
        } else {
          const errorMsg = response.error || "Google auth failed";
          setError(errorMsg);
          return false;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.auth.logout();
      setUser(null);
      setIsLoggedIn(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: UseAuthReturn = {
    isLoading,
    isLoggedIn,
    user,
    register,
    login,
    googleAuth,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth Hook - use this in components to access auth state and methods
 */
export function useAuth(): UseAuthReturn {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
