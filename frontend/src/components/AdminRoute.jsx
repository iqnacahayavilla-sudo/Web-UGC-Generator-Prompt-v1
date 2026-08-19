import React from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const AdminRoute = ({ children }) => {
  const { user, isAdmin, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-foreground">
              Memverifikasi Hak Akses Admin...
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Sinergi Visual Admin Portal
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-5">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Akses Ditolak</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Halaman ini khusus diperuntukkan bagi akun Administrator <strong>(sinergivisual.id@gmail.com)</strong>.
          </p>
          <div className="mt-4 rounded-xl border border-border/80 bg-background/80 p-3 text-xs text-muted-foreground">
            Akun Anda: <span className="font-mono font-bold text-foreground">{user?.email}</span>
          </div>
          <Link to="/" className="mt-6 block">
            <Button className="w-full gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Member Area</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminRoute;
