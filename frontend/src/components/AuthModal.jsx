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
            Masuk ke Member Area
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Akses portal pembuatan prompt video UGC otomatis Sinergi Visual.
          </p>
        </div>

        {/* Notice: Invite-Only Private Area */}
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Akses Terbatas (Invite-Only).</span> Akun member hanya dibuatkan secara resmi oleh Administrator.
            </div>
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
