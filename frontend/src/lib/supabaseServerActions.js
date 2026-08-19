/**
 * Sinergi Visual UGC Generator Prompt — Next.js Server Actions / Supabase Service
 * Modul ini menyediakan fungsi Server Actions & Client Service untuk manajemen kredit dan transaksi token.
 */

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
 * Server Action: Ambil Saldo Kredit User
 */
export async function getUserCreditsAction(userId = "guest-user") {
  try {
    // 1. Coba panggil API backend lokal / Next.js API
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
    const res = await fetch(`${backendUrl}/api/credits?user_id=${encodeURIComponent(userId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Backend credits API unreachable, using local fallback state:", e);
  }

  // 2. Fallback Client/Local State (dengan persistensi localStorage)
  const today = getTodayWIB();
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

  // Local fallback deduction
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

  // Local fallback update
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
