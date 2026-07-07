"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { isRole, type Role } from "./roles";

type AuthState = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  role: Role | null;
  signInAnon: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * 클라이언트 인증 컨텍스트.
 * role은 ID 토큰 custom claims에서 읽는다(클라이언트가 못 바꿈, docs/06).
 * Firebase 미설정이면 configured=false로 안전하게 비활성.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult().catch(() => null);
        const claim = token?.claims.role;
        setRole(isRole(claim) ? claim : "user");
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(() => {
    const auth = () => {
      const a = getFirebaseAuth();
      if (!a) throw new Error("Firebase auth not configured");
      return a;
    };
    return {
      configured,
      loading,
      user,
      role,
      signInAnon: async () => {
        await signInAnonymously(auth());
      },
      signInEmail: async (email, password) => {
        await signInWithEmailAndPassword(auth(), email, password);
      },
      signUpEmail: async (email, password) => {
        await createUserWithEmailAndPassword(auth(), email, password);
      },
      signInGoogle: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(auth(), provider);
      },
      signOut: async () => {
        await fbSignOut(auth());
      },
    };
  }, [configured, loading, user, role]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
