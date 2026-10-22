"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/app/lib/api";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "vgt_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on page load
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/auth/me", { token })
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await api<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: { email, password, remember },
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await api<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: payload,
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      if (token) await api("/auth/logout", { method: "POST", token });
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}