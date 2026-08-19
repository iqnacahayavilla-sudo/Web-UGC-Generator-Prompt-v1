import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  supabase,
  isSupabaseConfigured,
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  signInWithEmailOtp,
  signOutUser,
  getCurrentUser,
  getUserProfile,
} from "@/lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  profile: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isAuthModalOpen: false,
  authModalMode: "signin",
  openAuthModal: () => {},
  closeAuthModal: () => {},
  setAuthModalMode: () => {},
  signUp: async () => {},
  loginWithPassword: async () => {},
  loginWithGoogle: async () => {},
  loginWithEmailOtp: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("signin");

  // Fetch profil & metadata tambahan
  const loadProfile = useCallback(async (activeUser) => {
    if (!activeUser) {
      setProfile(null);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const data = await getUserProfile(activeUser.id);
        if (data?.profile) {
          setProfile(data.profile);
        } else {
          setProfile({
            id: activeUser.id,
            email: activeUser.email,
            full_name: activeUser.user_metadata?.full_name || activeUser.email?.split("@")[0] || "Kreator Sinergi",
            avatar_url: activeUser.user_metadata?.avatar_url || null,
            plan_type: activeUser.user_metadata?.plan_type || "free",
          });
        }
      } catch (err) {
        console.warn("Gagal memuat profil pengguna:", err);
      }
    } else {
      setProfile({
        id: activeUser.id,
        email: activeUser.email,
        full_name: activeUser.user_metadata?.full_name || activeUser.email?.split("@")[0] || "Kreator Sinergi",
        avatar_url: activeUser.user_metadata?.avatar_url || null,
        plan_type: activeUser.plan_type || "free",
      });
    }
  }, []);

  useEffect(() => {
    // 1. Inisialisasi Auth dari Supabase Session / Local Storage
    const initAuth = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            setSession(currentSession);
            setUser(currentSession.user);
            await loadProfile(currentSession.user);
          } else {
            const fallbackUser = await getCurrentUser();
            if (fallbackUser) {
              setUser(fallbackUser);
              await loadProfile(fallbackUser);
            }
          }
        } else {
          const fallbackUser = await getCurrentUser();
          if (fallbackUser) {
            setUser(fallbackUser);
            await loadProfile(fallbackUser);
          }
        }
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
        async (event, newSession) => {
          setSession(newSession);
          if (newSession?.user) {
            setUser(newSession.user);
            await loadProfile(newSession.user);
          } else if (event === "SIGNED_OUT") {
            setUser(null);
            setProfile(null);
          }
        }
      );

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [loadProfile]);

  const openAuthModal = (mode = "signin") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Mendaftar akun baru
  const signUp = async ({ email, password, fullName }) => {
    setIsLoading(true);
    try {
      const { data, error, simulated } = await signUpWithEmailPassword({
        email,
        password,
        fullName,
      });

      if (error) throw error;

      if (simulated && data?.user) {
        setUser(data.user);
        await loadProfile(data.user);
        toast.success(`Akun berhasil dibuat! Selamat datang, ${fullName || "Kreator"}! (+10 Token Bonus)`);
        closeAuthModal();
        return { success: true };
      }

      if (data?.session?.user) {
        setUser(data.session.user);
        await loadProfile(data.session.user);
        toast.success(`Pendaftaran berhasil! Selamat datang, ${fullName || "Kreator"}! (+10 Token Bonus)`);
        closeAuthModal();
        return { success: true };
      } else if (data?.user) {
        toast.success("Pendaftaran berhasil! Silakan periksa inbox email Anda untuk verifikasi.");
        closeAuthModal();
        return { success: true };
      }
    } catch (e) {
      const msg = e.message || "Gagal mendaftar akun baru.";
      toast.error(msg.includes("already registered") ? "Email sudah terdaftar. Silakan langsung masuk." : msg);
      return { success: false, error: e };
    } finally {
      setIsLoading(false);
    }
  };

  // Masuk dengan Email & Password
  const loginWithPassword = async ({ email, password }) => {
    setIsLoading(true);
    try {
      const { data, error, simulated } = await signInWithEmailPassword({
        email,
        password,
      });

      if (error) throw error;

      if (simulated && data?.user) {
        setUser(data.user);
        await loadProfile(data.user);
        toast.success(`Selamat datang kembali!`);
        closeAuthModal();
        return { success: true };
      }

      if (data?.session?.user || data?.user) {
        const active = data?.session?.user || data?.user;
        setUser(active);
        await loadProfile(active);
        const name = active.user_metadata?.full_name || active.email?.split("@")[0] || "Kreator";
        toast.success(`Selamat datang kembali, ${name}!`);
        closeAuthModal();
        return { success: true };
      }
    } catch (e) {
      const msg = e.message || "Gagal masuk.";
      toast.error(msg.includes("Invalid login credentials") ? "Email atau kata sandi tidak sesuai." : msg);
      return { success: false, error: e };
    } finally {
      setIsLoading(false);
    }
  };

  // Masuk dengan Google OAuth
  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      if (error) throw error;
      // Supabase OAuth otomatis mengalihkan browser ke halaman autentikasi Google
    } catch (e) {
      toast.error(e.message || "Gagal membuka halaman login Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // Masuk dengan Magic Link OTP
  const loginWithEmailOtp = async (email) => {
    setIsLoading(true);
    try {
      const { data, error, simulated } = await signInWithEmailOtp(email);
      if (error) throw error;

      if (simulated && data?.user) {
        setUser(data.user);
        await loadProfile(data.user);
        toast.success(`Berhasil login sebagai ${email}`);
        closeAuthModal();
      } else {
        toast.success("Tautan login (Magic Link) telah dikirim ke email Anda! Silakan periksa inbox.");
        closeAuthModal();
      }
    } catch (e) {
      toast.error(e.message || "Gagal mengirim link login.");
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
    setSession(null);
    toast.success("Berhasil logout dari akun.");
  };

  const ADMIN_EMAILS = ["iqna.cahayavilla@gmail.com", "sinergivisual.id@gmail.com"];

  const isAdmin = Boolean(
    user && (ADMIN_EMAILS.includes(user.email?.toLowerCase()) || user.user_metadata?.is_admin === true)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isAuthenticated: Boolean(user),
        isAdmin,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setAuthModalMode,
        signUp,
        loginWithPassword,
        loginWithGoogle,
        loginWithEmailOtp,
        logout,
        refreshProfile: () => loadProfile(user),
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
