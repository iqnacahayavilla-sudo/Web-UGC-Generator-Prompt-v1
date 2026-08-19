import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPassword, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika sudah login, otomatis arahkan ke Member Area (/)
  const fromPath = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(fromPath, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, fromPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Silakan masukkan email dan kata sandi Anda.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res?.success) {
        navigate(fromPath, { replace: true });
      }
    } catch (err) {
      // Error toast ditangani di AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 selection:bg-primary/20 selection:text-primary relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-md">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center">
          <Logo clickable={false} size="lg" />
          <h1 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Private Member Area
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
            Sinergi Visual UGC Video Prompt Generator Portal
          </p>
        </div>

        {/* Card Box */}
        <div className="mt-7 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          {/* Notice: Invite-Only Private Area */}
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Akses Terbatas (Invite-Only).</span> Akun member hanya dibuatkan secara resmi oleh Administrator.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Email Terdaftar</span>
              </label>
              <Input
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-background text-sm"
                data-testid="login-email-input"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Kata Sandi</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl bg-background pr-10 text-sm"
                  data-testid="login-password-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
              data-testid="login-submit-btn"
            >
              {isSubmitting ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Masuk ke Member Area</span>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </>
              )}
            </Button>
          </form>

          {/* Help & Contact Admin */}
          <div className="mt-6 border-t border-border/80 pt-5 text-center">
            <p className="text-xs text-muted-foreground">
              Belum memiliki akun member atau lupa kata sandi?
            </p>
            <a
              href="mailto:sinergivisual.id@gmail.com?subject=Permintaan%20Akses%20Member%20UGC%20Prompt"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Hubungi Admin (sinergivisual.id@gmail.com)</span>
            </a>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-[11px] text-muted-foreground">
          &copy; {new Date().getFullYear()} Sinergi Visual. Hak cipta dilindungi.
        </div>
      </div>
    </div>
  );
}
