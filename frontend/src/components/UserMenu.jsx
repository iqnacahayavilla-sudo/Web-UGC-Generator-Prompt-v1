import React, { useState } from "react";
import { User, LogOut, Crown, Zap, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/context/CreditContext";
import { Button } from "@/components/ui/button";

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const { totalCredits, planType, openPricingModal } = useCredits();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const fullName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Kreator";
  const avatarUrl = user.user_metadata?.avatar_url;
  const initial = fullName.charAt(0).toUpperCase();

  const planLabels = {
    free: "FREE",
    pro: "PRO KREATOR",
    enterprise: "ENTERPRISE",
  };

  return (
    <div className="relative" data-testid="user-menu-container">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 p-1 pr-2.5 transition-all hover:bg-secondary hover:border-primary/40 active:scale-[0.98]"
        data-testid="user-profile-btn"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 font-bold text-white text-xs overflow-hidden shadow-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <span className="max-w-[100px] truncate text-xs font-semibold text-foreground hidden sm:inline-block">
          {fullName}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-2xl border border-border/80 bg-card p-3 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150" data-testid="user-menu-dropdown">
            <div className="border-b border-border/60 pb-3 px-2">
              <div className="font-display text-sm font-bold text-foreground truncate">{fullName}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  {planLabels[planType] || "FREE"}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
                  {totalCredits} Token
                </span>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openPricingModal();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary/70 transition-colors"
                data-testid="user-menu-pricing"
              >
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span>Paket Langganan & Top Up</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                data-testid="user-menu-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;
