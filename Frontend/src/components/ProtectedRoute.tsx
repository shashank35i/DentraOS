// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export const AUTH_TOKEN_KEY = "authToken";

export const clearAuth = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("role");
    localStorage.removeItem("userName");
    localStorage.removeItem("userId");
  } catch {
    // ignore
  }
};

const isAuthenticated = () => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
  } catch {
    return false;
  }
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};
