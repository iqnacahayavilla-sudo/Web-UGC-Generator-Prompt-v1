/**
 * Sinergi Visual UGC Generator Prompt — Supabase Server Actions & Client Service
 * Modul sinkronisasi profil, kuota kredit harian, bonus sambutan, dan transaksi token.
 */
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// Konfigurasi kuota paket harian
export const PLAN_QUOTAS = {
  free: { name: "Free Kreator", daily: 100, price: 0 },
  pro: { name: "Pro Kreator", daily: 1000, price: 99000 },
  enterprise: { name: "Enterprise Studio", daily: 5000, price: 299000 },
};

// Dapatkan tanggal hari ini dalam zona waktu Asia/Jakarta (WIB) format YYYY-MM-DD
export function getTodayWIB() {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return wibTime.toISOString().split("T")[0];
}

/**
 * Server Action: Ambil Saldo Kredit User langsung dari Supabase Database (atau Backend / Local Storage)
 */
export async function getUserCreditsAction(userId = "guest-user") {
  const today = getTodayWIB();

  // 1. Jika Supabase aktif, prioritaskan query database Supabase
  if (isSupabaseConfigured && supabase && userId && userId !== "guest-user") {
    try {
      let { data: credits, error } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      let planType = "free";
      const { data: userProfile } = await supabase
        .from("users")
        .select("plan_type, full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile?.plan_type) {
        planType = userProfile.plan_type;
      }

      const quota = PLAN_QUOTAS[planType]?.daily || 100;

      // Jika belum ada row user_credits, inisialisasi dengan 100 daily + 10 bonus
      if (!credits) {
        const newRecord = {
          user_id: userId,
          daily_quota: quota,
          daily_credits_remaining: quota,
          bonus_credits: 10,
          last_reset_date: today,
        };

        const { data: inserted } = await supabase
          .from("user_credits")
          .insert(newRecord)
          .select()
          .single();

        credits = inserted || newRecord;
      } else if (credits.last_reset_date !== today) {
        // Auto reset harian 00:00 WIB
        const { data: updated } = await supabase
          .from("user_credits")
          .update({
            daily_quota: quota,
            daily_credits_remaining: quota,
            last_reset_date: today,
          })
          .eq("user_id", userId)
          .select()
          .single();

        credits = updated || {
          ...credits,
          daily_quota: quota,
          daily_credits_remaining: quota,
          last_reset_date: today,
        };
      }

      const dailyRemaining = credits.daily_credits_remaining ?? quota;
      const bonusCredits = credits.bonus_credits ?? 0;

      return {
        success: true,
        user_id: userId,
        plan_type: planType,
        daily_quota: quota,
        daily_credits_remaining: dailyRemaining,
        bonus_credits: bonusCredits,
        total_credits: dailyRemaining + bonusCredits,
        last_reset_date: credits.last_reset_date || today,
      };
    } catch (dbErr) {
      console.warn("Supabase direct query notice:", dbErr);
    }
  }

  // 2. Coba panggil API backend lokal / Next.js API
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
    const res = await fetch(`${backendUrl}/api/credits?user_id=${encodeURIComponent(userId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Backend credits API unreachable, using local fallback state:", e);
  }

  // 3. Fallback Client/Local State (dengan persistensi localStorage)
  let stored = null;
  try {
    const raw = localStorage.getItem(`sinergi_credits_${userId}`);
    if (raw) stored = JSON.parse(raw);
  } catch (e) {}

  if (!stored) {
    stored = {
      user_id: userId,
      plan_type: "free",
      daily_quota: 100,
      daily_credits_remaining: 100,
      bonus_credits: 10,
      last_reset_date: today,
    };
  } else if (stored.last_reset_date !== today) {
    // Auto reset harian 00:00 WIB
    const quota = PLAN_QUOTAS[stored.plan_type]?.daily || 100;
    stored.daily_quota = quota;
    stored.daily_credits_remaining = quota;
    stored.last_reset_date = today;
  }

  try {
    localStorage.setItem(`sinergi_credits_${userId}`, JSON.stringify(stored));
  } catch (e) {}

  return {
    success: true,
    ...stored,
    total_credits: stored.daily_credits_remaining + stored.bonus_credits,
  };
}

/**
 * Server Action: Kurangi Kredit Token User (Prioritaskan Daily, lalu Bonus)
 */
export async function consumeCreditsAction({
  userId = "guest-user",
  tokens = 1,
  category = "UGC Video Prompt",
  promptResult = null,
  modelUsed = "gemini-flash",
}) {
  // 1. Jika Supabase aktif, coba panggil RPC consume_user_credits
  if (isSupabaseConfigured && supabase && userId && userId !== "guest-user") {
    try {
      const { data, error } = await supabase.rpc("consume_user_credits", {
        p_user_id: userId,
        p_tokens: tokens,
        p_category: category,
        p_prompt_result: typeof promptResult === "string" ? promptResult : JSON.stringify(promptResult),
        p_model_used: modelUsed,
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (rpcErr) {
      console.warn("Supabase RPC consume warning:", rpcErr);
    }
  }

  // 2. Coba panggil Backend API
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
    const res = await fetch(`${backendUrl}/api/credits/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        tokens,
        category,
        prompt_result: promptResult,
        model_used: modelUsed,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error_code: data.detail?.code || "KREDIT_HABIS",
        message: data.detail?.message || "Saldo kredit Anda tidak mencukupi.",
        ...data,
      };
    }
    return data;
  } catch (e) {
    console.warn("Backend consume API unreachable, performing local deduction:", e);
  }

  // 3. Local fallback deduction
  const current = await getUserCreditsAction(userId);
  const total = current.daily_credits_remaining + current.bonus_credits;

  if (total < tokens) {
    return {
      success: false,
      error_code: "KREDIT_HABIS",
      message: "Saldo kredit Anda tidak mencukupi. Silakan lakukan top up atau upgrade paket.",
      daily_credits_remaining: current.daily_credits_remaining,
      bonus_credits: current.bonus_credits,
      total_credits: total,
      required: tokens,
    };
  }

  let dailyRem = current.daily_credits_remaining;
  let bonusRem = current.bonus_credits;
  let deductDaily = 0;
  let deductBonus = 0;

  if (dailyRem >= tokens) {
    deductDaily = tokens;
    dailyRem -= tokens;
  } else {
    deductDaily = dailyRem;
    deductBonus = tokens - dailyRem;
    dailyRem = 0;
    bonusRem -= deductBonus;
  }

  const updated = {
    ...current,
    daily_credits_remaining: dailyRem,
    bonus_credits: bonusRem,
  };

  try {
    localStorage.setItem(`sinergi_credits_${userId}`, JSON.stringify(updated));
  } catch (e) {}

  return {
    success: true,
    tokens_consumed: tokens,
    deducted_from_daily: deductDaily,
    deducted_from_bonus: deductBonus,
    daily_credits_remaining: dailyRem,
    bonus_credits: bonusRem,
    total_credits: dailyRem + bonusRem,
  };
}

/**
 * Server Action: Top Up Bonus Kredit atau Upgrade Plan Langganan
 */
export async function topupCreditsAction({
  userId = "guest-user",
  bonusTokens = 0,
  newPlan = null,
  pricePaid = 0,
  paymentRef = `INV-${Date.now()}`,
}) {
  // 1. Jika Supabase aktif, coba panggil RPC topup_user_credits
  if (isSupabaseConfigured && supabase && userId && userId !== "guest-user") {
    try {
      const { data, error } = await supabase.rpc("topup_user_credits", {
        p_user_id: userId,
        p_bonus_tokens: bonusTokens,
        p_new_plan: newPlan,
        p_price_paid: pricePaid,
        p_payment_ref: paymentRef,
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (rpcErr) {
      console.warn("Supabase RPC topup warning:", rpcErr);
    }
  }

  // 2. Coba panggil Backend API
  try {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
    const res = await fetch(`${backendUrl}/api/credits/topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        bonus_tokens: bonusTokens,
        new_plan: newPlan,
        price_paid: pricePaid,
        payment_ref: paymentRef,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Backend topup API unreachable, performing local update:", e);
  }

  // 3. Local fallback update
  const current = await getUserCreditsAction(userId);
  let quota = current.daily_quota;
  let dailyRem = current.daily_credits_remaining;
  let plan = current.plan_type;

  if (newPlan && PLAN_QUOTAS[newPlan]) {
    plan = newPlan;
    quota = PLAN_QUOTAS[newPlan].daily;
    dailyRem = Math.max(dailyRem, quota);
  }

  const updated = {
    ...current,
    plan_type: plan,
    daily_quota: quota,
    daily_credits_remaining: dailyRem,
    bonus_credits: current.bonus_credits + bonusTokens,
  };

  try {
    localStorage.setItem(`sinergi_credits_${userId}`, JSON.stringify(updated));
  } catch (e) {}

  return {
    success: true,
    bonus_added: bonusTokens,
    new_plan: plan,
    daily_credits_remaining: updated.daily_credits_remaining,
    bonus_credits: updated.bonus_credits,
    total_credits: updated.daily_credits_remaining + updated.bonus_credits,
  };
}
