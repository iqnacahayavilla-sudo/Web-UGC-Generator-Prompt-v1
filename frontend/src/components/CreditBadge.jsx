import React, { useState } from "react";
import { Zap, Coins, PlusCircle, Sparkles, ChevronDown, Clock, ShieldCheck } from "lucide-react";
import { useCredits } from "@/context/CreditContext";
import { Button } from "@/components/ui/button";

export const CreditBadge = ({ className = "" }) => {
  const {
    dailyRemaining,
    dailyQuota,
    bonusCredits,
    totalCredits,
    planType,
    openPricingModal,
  } = useCredits();

  const [isOpen, setIsOpen] = useState(false);

  const planLabels = {
    free: { text: "FREE", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
    pro: { text: "PRO", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
    enterprise: { text: "STUDIO", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  };

  const currentPlan = planLabels[planType] || planLabels.free;
  const isLow = totalCredits <= 10;
  const isZero = totalCredits === 0;

  return (
    <div className={`relative ${className}`} data-testid="credit-badge-container">
      {/* Main Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
          isZero
            ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
            : isLow
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "border-border/80 bg-secondary/50 text-foreground hover:bg-secondary/80"
        }`}
        data-testid="credit-indicator-btn"
        title="Lihat Rincian Saldo Kredit Token"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
        </span>

        <div className="flex items-center gap-1.5">
          <span className="font-bold tracking-tight">
            {dailyRemaining} <span className="font-normal text-muted-foreground">/ {dailyQuota}</span>
          </span>
          {bonusCredits > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400" title={`+${bonusCredits} Bonus Token Permanen`}>
              +{bonusCredits}
            </span>
          )}
        </div>

        <span className={`hidden sm:inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${currentPlan.color}`}>
          {currentPlan.text}
        </span>

        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Breakdown Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-border/80 bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150" data-testid="credit-breakdown-popover">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="font-display text-xs font-bold text-foreground">Saldo Token Sinergi</span>
              </div>
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${currentPlan.color}`}>
                {currentPlan.text} PLAN
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-2.5">
                <div>
                  <div className="font-medium text-foreground">Kredit Harian</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" /> Reset 00:00 WIB
                  </div>
                </div>
                <div className="font-display text-sm font-bold text-primary">
                  {dailyRemaining} <span className="text-xs font-normal text-muted-foreground">/ {dailyQuota}</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-2.5">
                <div>
                  <div className="font-medium text-foreground">Bonus Token Cadangan</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> Tanpa kedaluwarsa
                  </div>
                </div>
                <div className="font-display text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {bonusCredits} Token
                </div>
              </div>

              <div className="flex items-center justify-between px-1 pt-1 font-semibold text-foreground">
                <span>Total Token Tersedia</span>
                <span className="font-display text-base font-extrabold text-foreground">{totalCredits} Token</span>
              </div>
            </div>

            <Button
              className="mt-4 h-10 w-full gap-2 rounded-xl text-xs font-bold shadow-sm"
              onClick={() => {
                setIsOpen(false);
                openPricingModal();
              }}
              data-testid="badge-topup-btn"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Top Up / Upgrade Paket</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CreditBadge;
