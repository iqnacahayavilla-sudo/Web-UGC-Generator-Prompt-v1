import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Mail, Zap, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LogoIcon } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const AuthModal = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    loginWithGoogle,
    loginWithEmail,
    isLoading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    await loginWithGoogle();
    setIsSubmitting(false);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setIsSubmitting(true);
    await loginWithEmail(email.trim());
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
        className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl overflow-hidden"
        data-testid="auth-modal"
      >
        {/* Glow ambient */}
        <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          data-testid="close-auth-modal-btn"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex justify-center mb-3">
            <LogoIcon className="w-12 h-12" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
            Masuk ke Sinergi Visual
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Dapatkan akses penuh ke generator prompt video UGC dan 100 token gratis setiap hari.
          </p>
        </div>

        {/* Benefits Badges */}
        <div className="mt-5 space-y-2 rounded-2xl bg-secondary/40 p-3.5 border border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <span>100 Token Gratis Setiap Hari (Reset 00:00 WIB)</span>
          </div>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Bonus Sambutan +10 Token Permanen</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <div className="mt-6">
          <Button
            type="button"
            className="w-full h-12 gap-3 rounded-xl border border-border bg-card text-foreground font-bold shadow-sm hover:bg-secondary/80 hover:border-primary/40 active:scale-[0.99] transition-all"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || isLoading}
            data-testid="google-login-btn"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold">atau dengan email</span>
          </div>
        </div>

        {/* Email Magic Link Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl bg-background"
              required
              data-testid="auth-email-input"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 gap-2 rounded-xl font-bold"
            disabled={isSubmitting || isLoading}
            data-testid="email-login-btn"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            <span>Kirim Link Masuk</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        {/* Footer Note */}
        <div className="mt-5 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Autentikasi aman terenkripsi oleh Supabase</span>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthModal;
