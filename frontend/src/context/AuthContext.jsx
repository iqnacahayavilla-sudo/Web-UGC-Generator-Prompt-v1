import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  supabase,
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithEmail,
  signOutUser,
  getCurrentUser,
} from "@/lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // 1. Ambil session awal
    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // 2. Pasang event listener auth state change jika Supabase aktif
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (session?.user) {
            setUser(session.user);
          } else if (event === "SIGNED_OUT") {
            setUser(null);
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const { data, error, simulated } = await signInWithGoogle();
      if (error) throw error;

      if (simulated && data?.user) {
        setUser(data.user);
        toast.success(`Selamat datang, ${data.user.user_metadata?.full_name || "Kreator"}!`);
        setIsAuthModalOpen(false);
      }
    } catch (e) {
      toast.error(e.message || "Gagal login dengan Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email) => {
    setIsLoading(true);
    try {
      const { data, error, simulated } = await signInWithEmail(email);
      if (error) throw error;

      if (simulated && data?.user) {
        setUser(data.user);
        toast.success(`Berhasil login sebagai ${email}`);
        setIsAuthModalOpen(false);
      } else {
        toast.success("Tautan login (Magic Link) telah dikirim ke email Anda!");
        setIsAuthModalOpen(false);
      }
    } catch (e) {
      toast.error(e.message || "Gagal mengirim link login.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await signOutUser();
    setUser(null);
    toast.success("Berhasil logout dari akun.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        loginWithGoogle,
        loginWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
