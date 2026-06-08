import React from "react";
import { useAuth } from "../providers/AuthProvider";
import { API_URL } from "../lib/api";
import Logo from "./Logo";

type Props = {
  children: React.ReactNode;
};

export default function PrivateRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 24,
          background: "var(--mantine-color-body)",
        }}
      >
        <Logo height={56} />
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#7c3aed",
                animation: "ra-bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes ra-bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40%            { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    window.location.href = `${API_URL}/auth/github`;
    return null;
  }

  return <>{children}</>;
}
