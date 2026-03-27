import React from "react";
import { useAuth } from "../providers/AuthProvider";

type Props = {
  children: React.ReactNode;
};

export default function PrivateRoute({ children }: Props) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  console.log(user);
  if (!user) {
    window.location.href = "http://localhost:5000/auth";
    return null;
  }

  return <>{children}</>;
}
