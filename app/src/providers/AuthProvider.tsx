import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { API_URL } from "../lib/api";

type Plan = "free" | "pro" | "team" | null;

type User = {
  github_id: string;
  username: string;
  email: string | null;
  authenticated: boolean;
  plan: Plan;
  credits_remaining: number | null;
};

export type { User, Plan };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/status`, { credentials: "include" });
      const data: User = await res.json();
      setUser(data.authenticated ? data : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
