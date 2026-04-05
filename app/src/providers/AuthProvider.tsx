import React, { createContext, useContext, useEffect, useState } from "react";
import { API_URL } from "../lib/api";

type User = {
  github_id: string;
  username: string;
  email: string | null;
  authenticated: boolean;
};

export type { User };

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch(`${API_URL}/auth/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: User) => setUser(data.authenticated ? data : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
