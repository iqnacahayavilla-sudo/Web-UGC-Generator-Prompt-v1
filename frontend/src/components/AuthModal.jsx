import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Mail,
  Lock,
  User,
  Zap,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LogoIcon } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const AuthModal = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    loginWithGoogle,
    loginWithPassword,
    signUp,
    loginWithEmailOtp,
    isLoading: isAuthLoading,
  } = useAuth();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [useOtp, setUseOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (authModalMode) {
      setMode(authModalMode);
    }
  }, [authModalMode]);

  useEffect(() => {
    setValidationError("");
  }, [mode, useOtp, email, password, confirmPassword]);

  if (!isAuthModalOpen) return null;

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    await loginWithGoogle();
    setIsSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (!email.trim() || !email.includes("@")) {
      setValidationError("Silakan masukkan alamat email yang valid.");
      return;
    }

    // Sign Up Flow
    if (mode === "signup") {
      if (!fullName.trim()) {
        setValidationError("Silakan masukkan nama lengkap Anda.");
        return;
      }
      if (!password || password.length < 6) {
        setValidationError("Kata sandi minimal harus 6 karakter.");
        return;
      }
      if (password !== confirmPassword) {
        setValidationError("Konfirmasi kata sandi tidak cocok.");
        return;
      }

      setIsSubmitting(true);
      const res = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      setIsSubmitting(false);
      return;
    }

    // Sign In with Magic Link OTP
    if (useOtp) {
      setIsSubmitting(true);
      await loginWithEmailOtp(email.trim());
      setIsSubmitting(false);
      return;
    }

    // Sign In with Password
    if (!password) {
      setValidationError("Silakan masukkan kata sandi Anda.");
      return;
    }

    setIsSubmitting(true);
    await loginWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" data-testid="auth-modal-overlay">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity" onClick={closeAuthModal} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl overflow-hidden my-8"
        data-testid="auth-modal"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          data-testid="close-auth-modal-btn"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Logo & Title */}
        <div className="text-center">
          <div className="mx-auto flex justify-center mb-3">
            <LogoIcon className="w-12 h-12" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
            {mode === "signup" ? "Buat Akun Kreator Baru" : "Masuk ke Akun Anda"}
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            {mode === "signup"
              ? "Daftar sekarang dan nikmati kuota generator prompt video UGC otomatis."
              : "Akses kembali riwayat prompt UGC dan kuota token harian Anda."}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-5 grid grid-cols-2 p-1 bg-secondary/60 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setAuthModalMode("signin");
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "signin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-signin"
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setAuthModalMode("signup");
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-signup"
          >
            Daftar Akun Baru
          </button>
        </div>

        {/* Benefits Badges */}
        <div className="mt-4 space-y-1.5 rounded-2xl bg-secondary/40 p-3 border border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>100 Token Gratis Setiap Hari (Reset 00:00 WIB)</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>Bonus Sambutan +10 Token Permanen</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <div className="mt-5">
          <Button
            type="button"
            className="w-full h-11 gap-3 rounded-xl border border-border bg-card text-foreground font-bold shadow-sm hover:bg-secondary/80 hover:border-primary/40 active:scale-[0.99] transition-all"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || isAuthLoading}
            data-testid="google-login-btn"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isSubmitting ? "Menghubungkan..." : "Lanjutkan dengan Google"}</span>
          </Button>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold">
              atau dengan email & password
            </span>
          </div>
        </div>

        {/* Error Validation Alert */}
        {validationError && (
          <div className="mb-3 rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive font-medium flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Contoh: Budi Pratama"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10 pl-10 rounded-xl bg-background text-xs"
                  required
                  data-testid="auth-fullname-input"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 pl-10 rounded-xl bg-background text-xs"
                required
                data-testid="auth-email-input"
              />
            </div>
          </div>

          {(!useOtp || mode === "signup") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">Kata Sandi</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setUseOtp(true)}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Masuk via Magic Link
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Minimal 6 karakter" : "Masukkan kata sandi"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pl-10 pr-10 rounded-xl bg-background text-xs"
                  required
                  data-testid="auth-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ulangi kata sandi"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 pl-10 rounded-xl bg-background text-xs"
                  required
                  data-testid="auth-confirm-password-input"
                />
              </div>
            </div>
          )}

          {useOtp && mode === "signin" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setUseOtp(false)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Gunakan kata sandi biasa
              </button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 gap-2 rounded-xl font-bold mt-2 shadow-sm"
            disabled={isSubmitting || isAuthLoading}
            data-testid="auth-submit-btn"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signup" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : useOtp ? (
              <Mail className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>
              {isSubmitting
                ? "Memproses..."
                : mode === "signup"
                ? "Daftar Akun & Ambil 110 Token"
                : useOtp
                ? "Kirim Magic Link Masuk"
                : "Masuk Sekarang"}
            </span>
          </Button>
        </form>

        {/* Mode Toggle Footer */}
        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <span>
              Belum punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setAuthModalMode("signup");
                }}
                className="font-bold text-primary hover:underline"
              >
                Daftar sekarang
              </button>
            </span>
          ) : (
            <span>
              Sudah punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setAuthModalMode("signin");
                }}
                className="font-bold text-primary hover:underline"
              >
                Masuk di sini
              </button>
            </span>
          )}
        </div>

        {/* Footer Security Badge */}
        <div className="mt-5 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 border-t border-border/40 pt-3">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Autentikasi aman & terenkripsi oleh Supabase</span>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthModal;
