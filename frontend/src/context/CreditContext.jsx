import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  getUserCreditsAction,
  consumeCreditsAction,
  topupCreditsAction,
  getTodayWIB,
  PLAN_QUOTAS,
} from "@/lib/supabaseServerActions";

const CreditContext = createContext({
  userId: "guest-user",
  planType: "free",
  dailyQuota: 100,
  dailyRemaining: 100,
  bonusCredits: 10,
  totalCredits: 110,
  lastResetDate: "",
  isLoading: true,
  isPricingModalOpen: false,
  openPricingModal: () => {},
  closePricingModal: () => {},
  refreshCredits: async () => {},
  consume: async () => {},
  topup: async () => {},
});

export const CreditProvider = ({ children }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || user?.email || "guest-user";

  const [credits, setCredits] = useState({
    userId: currentUserId,
    planType: "free",
    dailyQuota: 100,
    dailyRemaining: 100,
    bonusCredits: 10,
    totalCredits: 110,
    lastResetDate: getTodayWIB(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const fetchCredits = useCallback(async () => {
    try {
      const data = await getUserCreditsAction(currentUserId);
      if (data) {
        setCredits({
          userId: data.user_id || currentUserId,
          planType: data.plan_type || "free",
          dailyQuota: data.daily_quota ?? 100,
          dailyRemaining: data.daily_credits_remaining ?? 100,
          bonusCredits: data.bonus_credits ?? 0,
          totalCredits: (data.daily_credits_remaining ?? 100) + (data.bonus_credits ?? 0),
          lastResetDate: data.last_reset_date || getTodayWIB(),
        });
      }
    } catch (e) {
      console.error("Gagal mengambil data kredit:", e);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Konsumsi Token
  const consume = async (tokens = 1, category = "UGC Video Prompt", promptResult = null) => {
    const res = await consumeCreditsAction({
      userId: currentUserId,
      tokens,
      category,
      promptResult,
    });

    if (res.success) {
      setCredits((prev) => ({
        ...prev,
        dailyRemaining: res.daily_credits_remaining,
        bonusCredits: res.bonus_credits,
        totalCredits: res.total_credits,
      }));
      return true;
    } else {
      if (res.error_code === "KREDIT_HABIS" || res.total_credits === 0) {
        setIsPricingModalOpen(true);
        toast.error("Saldo kredit Anda telah habis. Silakan top up atau upgrade paket.");
      } else {
        toast.error(res.message || "Gagal memproses pengurangan kredit.");
      }
      return false;
    }
  };

  // Top Up atau Upgrade
  const topup = async (bonusTokens = 0, newPlan = null, pricePaid = 0) => {
    try {
      const res = await topupCreditsAction({
        userId: currentUserId,
        bonusTokens,
        newPlan,
        pricePaid,
      });

      if (res.success) {
        setCredits((prev) => ({
          ...prev,
          planType: res.new_plan || prev.planType,
          dailyQuota: res.new_plan ? PLAN_QUOTAS[res.new_plan]?.daily || prev.dailyQuota : prev.dailyQuota,
          dailyRemaining: res.daily_credits_remaining ?? prev.dailyRemaining,
          bonusCredits: res.bonus_credits ?? (prev.bonusCredits + bonusTokens),
          totalCredits: res.total_credits ?? (prev.totalCredits + bonusTokens),
        }));
        toast.success(
          newPlan
            ? `Berhasil upgrade ke paket ${PLAN_QUOTAS[newPlan]?.name || newPlan}!`
            : `Berhasil menambahkan +${bonusTokens} token kredit!`
        );
        setIsPricingModalOpen(false);
        return true;
      }
    } catch (e) {
      toast.error("Gagal memproses transaksi top up.");
      return false;
    }
  };

  return (
    <CreditContext.Provider
      value={{
        ...credits,
        userId: currentUserId,
        isLoading,
        isPricingModalOpen,
        openPricingModal: () => setIsPricingModalOpen(true),
        closePricingModal: () => setIsPricingModalOpen(false),
        refreshCredits: fetchCredits,
        consume,
        topup,
      }}
    >
      {children}
    </CreditContext.Provider>
  );
};

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCredits must be used within a CreditProvider");
  }
  return context;
};
