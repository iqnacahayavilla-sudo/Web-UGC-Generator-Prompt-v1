import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Check, Sparkles, Zap, ShieldCheck, Crown, ArrowRight,
  CreditCard, QrCode, Building2, HelpCircle, Flame, CheckCircle2,
  Copy, Loader2, RefreshCw,
} from "lucide-react";
import { useCredits } from "@/context/CreditContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PLANS = [
  {
    id: "free",
    name: "Free Kreator",
    price: 0,
    period: "Selamanya",
    badge: "Paket Dasar",
    dailyTokens: 100,
    popular: false,
    description: "Cocok untuk eksplorasi dan pembuatan prompt video harian.",
    features: [
      "100 Token Generator / Hari",
      "Reset otomatis setiap 00:00 WIB",
      "Analisis Karakteristik Produk OpenAI Vision",
      "Seluruh Pilihan Gaya & Kreator UGC",
      "Ekspor Prompt Standar Google Flow",
    ],
  },
  {
    id: "pro",
    name: "Pro Kreator",
    price: 99000,
    period: "Bulan",
    badge: "Paling Populer",
    dailyTokens: 1000,
    popular: true,
    description: "Untuk seller & kreator aktif yang butuh kuota tinggi dan antrean cepat.",
    features: [
      "1.000 Token Generator / Hari",
      "Prioritas Pemrosesan AI Tercepat",
      "Akses Fitur Konsistensi Karakter Lanjutan",
      "Multi-Variasi Hook & Naskah Bahasa Lengkap",
      "Dukungan Komunitas & Support Prioritas",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise Studio",
    price: 299000,
    period: "Bulan",
    badge: "Agensi & Tim",
    dailyTokens: 5000,
    popular: false,
    description: "Untuk agensi periklanan, brand studio, dan tim produksi video skala besar.",
    features: [
      "5.000 Token Generator / Hari",
      "Akses Multi-User & Kolaborasi Tim",
      "Akses Model AI Vision Eksklusif",
      "Integrasi API & Webhook Kustom",
      "Dedicated Account Manager & SLA 99.9%",
    ],
  },
];

const TOPUPS = [
  {
    id: "topup_50",
    tokens: 50,
    price: 25000,
    unitPrice: "Rp 500 / token",
    badge: "Praktis",
    description: "50 Token cadangan tanpa masa kedaluwarsa.",
  },
  {
    id: "topup_200",
    tokens: 200,
    price: 75000,
    unitPrice: "Rp 375 / token",
    badge: "Paling Laris",
    popular: true,
    description: "200 Token cadangan permanen saat kuota harian habis.",
  },
  {
    id: "topup_500",
    tokens: 500,
    price: 150000,
    unitPrice: "Rp 300 / token",
    badge: "Hemat 40%",
    description: "500 Token cadangan untuk batch campaign dan iklan masif.",
  },
];

function formatRupiah(num) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

export const PricingModal = () => {
  const {
    isPricingModalOpen,
    closePricingModal,
    planType,
    topup,
    refreshCredits,
  } = useCredits();

  const { user, isAuthenticated, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState("subscription"); // 'subscription' | 'topup'
  const [selectedItem, setSelectedItem] = useState(null); // { type, id, name, price, tokens, plan }
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState("select"); // 'select' | 'checkout' | 'success'
  const [selectedMethod, setSelectedMethod] = useState("qris"); // 'qris' | 'bca_va' | 'mandiri_va' | 'card'

  if (!isPricingModalOpen) return null;

  const handleSelectPlan = (plan) => {
    if (plan.id === planType) return;
    if (plan.price === 0) {
      topup(0, "free", 0);
      return;
    }

    if (!isAuthenticated) {
      toast.info("Silakan masuk ke akun Anda terlebih dahulu untuk berlangganan.");
      openAuthModal();
      return;
    }

    setSelectedItem({
      type: "subscription",
      id: plan.id,
      name: plan.name,
      price: plan.price,
      dailyTokens: plan.dailyTokens,
      plan: plan.id,
    });
    setPaymentStep("checkout");
  };

  const handleSelectTopup = (pkg) => {
    if (!isAuthenticated) {
      toast.info("Silakan masuk ke akun Anda terlebih dahulu untuk membeli token.");
      openAuthModal();
      return;
    }

    setSelectedItem({
      type: "topup",
      id: pkg.id,
      name: `+${pkg.tokens} Token Refill`,
      price: pkg.price,
      tokens: pkg.tokens,
    });
    setPaymentStep("checkout");
  };

  const handleProcessPayment = async () => {
    if (!selectedItem) return;
    setIsProcessing(true);

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
      
      // 1. Panggil create-transaction
      const transRes = await fetch(`${backendUrl}/api/payments/create-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || user?.email || "guest-user",
          item_type: selectedItem.type,
          item_id: selectedItem.id,
          amount: selectedItem.price,
          item_name: selectedItem.name,
          customer_name: user?.user_metadata?.full_name || "Kreator Sinergi",
          customer_email: user?.email || "kreator@sinergivisual.com",
          gateway: "midtrans",
        }),
      });

      const transData = await transRes.json();

      // 2. Simulasi pembayaran & webhook aktivasi instan
      const simRes = await fetch(`${backendUrl}/api/payments/simulate-success`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || user?.email || "guest-user",
          bonus_tokens: selectedItem.tokens || 0,
          new_plan: selectedItem.plan || null,
          price_paid: selectedItem.price,
          payment_ref: transData.order_id || `ORD-${Date.now()}`,
        }),
      });

      const simData = await simRes.json();
      await refreshCredits();

      setPaymentStep("success");
      toast.success(
        selectedItem.type === "subscription"
          ? `Selamat! Paket ${selectedItem.name} telah aktif!`
          : `Pembayaran berhasil! +${selectedItem.tokens} Token telah ditambahkan ke akun Anda!`
      );
    } catch (e) {
      toast.error("Terjadi kendala saat memproses pembayaran. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedItem(null);
    setPaymentStep("select");
    closePricingModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" data-testid="pricing-modal-overlay">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity" onClick={handleClose} />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-4xl rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl overflow-hidden my-8"
        data-testid="pricing-modal"
      >
        {/* Glow ambient */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          data-testid="close-pricing-modal-btn"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ----------------- CHECKOUT STEP ----------------- */}
        {paymentStep === "checkout" && selectedItem ? (
          <div className="max-w-xl mx-auto py-2" data-testid="checkout-view">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                <CreditCard className="h-3.5 w-3.5" /> Pembayaran Midtrans Gateway
              </span>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Ringkasan Pembayaran
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                Selesaikan pembayaran untuk mengaktifkan token / paket ke akun Anda secara otomatis.
              </p>
            </div>

            {/* Order Card */}
            <div className="mt-6 rounded-2xl border border-border/80 bg-secondary/30 p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Item Pembelian</div>
                  <div className="font-display text-lg font-extrabold text-foreground mt-0.5">{selectedItem.name}</div>
                  <div className="text-xs text-primary font-semibold mt-0.5">
                    {selectedItem.type === "subscription" ? `📅 ${selectedItem.dailyTokens} Token / Hari` : `⚡ +${selectedItem.tokens} Token Permanen`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Biaya</div>
                  <div className="font-display text-xl font-extrabold text-foreground mt-0.5">{formatRupiah(selectedItem.price)}</div>
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div className="mt-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  Pilih Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { id: "qris", label: "QRIS", sub: "GoPay / OVO", icon: QrCode },
                    { id: "bca_va", label: "BCA VA", sub: "Transfer Bank", icon: Building2 },
                    { id: "mandiri_va", label: "Mandiri VA", sub: "Transfer Bank", icon: Building2 },
                    { id: "card", label: "Kartu Debit", sub: "Visa / Master", icon: CreditCard },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                        selectedMethod === m.id
                          ? "border-primary bg-primary/10 ring-2 ring-primary/40 font-bold"
                          : "border-border bg-card hover:bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      <m.icon className={`h-5 w-5 mb-1 ${selectedMethod === m.id ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-bold text-foreground">{m.label}</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-xl px-5 text-xs font-bold"
                onClick={() => setPaymentStep("select")}
                disabled={isProcessing}
              >
                Kembali
              </Button>
              <Button
                className="h-12 flex-1 gap-2 rounded-xl text-sm font-bold shadow-md"
                onClick={handleProcessPayment}
                disabled={isProcessing}
                data-testid="confirm-payment-btn"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses Pembayaran...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Bayar {formatRupiah(selectedItem.price)} (Instan)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : paymentStep === "success" ? (
          /* ----------------- SUCCESS STEP ----------------- */
          <div className="max-w-md mx-auto py-8 text-center" data-testid="payment-success-view">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 mb-4 shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
              Pembayaran Berhasil!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Token kredit / paket langganan Anda telah aktif dan dapat langsung digunakan untuk membuat prompt video UGC.
            </p>
            <Button
              className="mt-6 h-12 w-full rounded-xl font-bold shadow-md"
              onClick={handleClose}
              data-testid="payment-done-btn"
            >
              <span>Lanjut Buat Video UGC</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          /* ----------------- PLANS & TOPUP SELECTION ----------------- */
          <>
            {/* Header */}
            <div className="text-center max-w-xl mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Sinergi Visual Token & Pricing
              </span>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Pilih Paket & Isi Ulang Token
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                Tingkatkan batas kuota harian Anda atau beli token cadangan permanen yang siap dipakai kapan saja.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="mt-6 flex justify-center">
              <div className="flex rounded-2xl border border-border bg-secondary/50 p-1.5">
                <button
                  onClick={() => setActiveTab("subscription")}
                  className={`rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                    activeTab === "subscription"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="tab-subscription"
                >
                  📅 Paket Langganan Harian
                </button>
                <button
                  onClick={() => setActiveTab("topup")}
                  className={`rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                    activeTab === "topup"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="tab-topup"
                >
                  ⚡ Top-Up Token Instan
                </button>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="mt-7">
              {activeTab === "subscription" ? (
                <div className="grid gap-5 sm:grid-cols-3" data-testid="subscription-plans">
                  {PLANS.map((plan) => {
                    const isCurrent = planType === plan.id;
                    return (
                      <div
                        key={plan.id}
                        className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                          plan.popular
                            ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-lg scale-[1.02]"
                            : "border-border/80 bg-card hover:border-primary/40 shadow-sm"
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
                            {plan.badge}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-base font-bold text-foreground">{plan.name}</h3>
                            {!plan.popular && (
                              <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {plan.badge}
                              </span>
                            )}
                          </div>

                          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{plan.description}</p>

                          <div className="mt-4 flex items-baseline gap-1">
                            <span className="font-display text-2xl font-extrabold text-foreground">
                              {plan.price === 0 ? "Gratis" : formatRupiah(plan.price)}
                            </span>
                            {plan.price > 0 && <span className="text-xs text-muted-foreground">/ {plan.period}</span>}
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-xs font-bold text-primary">
                            <Zap className="h-4 w-4 fill-primary" />
                            <span>{plan.dailyTokens} Token / Hari (00:00 WIB)</span>
                          </div>

                          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                            {plan.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span className="leading-snug">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button
                          className={`mt-6 h-11 w-full rounded-xl text-xs font-bold shadow-sm ${
                            isCurrent
                              ? "bg-secondary text-muted-foreground cursor-default border border-border"
                              : plan.popular
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "variant-outline"
                          }`}
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(plan)}
                          data-testid={`btn-plan-${plan.id}`}
                        >
                          {isCurrent ? "Paket Anda Saat Ini" : plan.price === 0 ? "Gunakan Paket Gratis" : `Pilih ${plan.name}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-3" data-testid="topup-packages">
                  {TOPUPS.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                        pkg.popular
                          ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-lg scale-[1.02]"
                          : "border-border/80 bg-card hover:border-primary/40 shadow-sm"
                      }`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
                          {pkg.badge}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-base font-bold text-foreground">+{pkg.tokens} Token</h3>
                          {!pkg.popular && (
                            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {pkg.badge}
                            </span>
                          )}
                        </div>

                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{pkg.description}</p>

                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="font-display text-2xl font-extrabold text-foreground">{formatRupiah(pkg.price)}</span>
                          <span className="text-xs text-muted-foreground">({pkg.unitPrice})</span>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-4 w-4" />
                          <span>Permanen Tanpa Kadaluwarsa</span>
                        </div>
                      </div>

                      <Button
                        className="mt-6 h-11 w-full gap-2 rounded-xl text-xs font-bold shadow-sm"
                        onClick={() => handleSelectTopup(pkg)}
                        data-testid={`btn-topup-${pkg.id}`}
                      >
                        <Zap className="h-4 w-4" />
                        <span>Beli +{pkg.tokens} Token</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-border/60 pt-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Pembayaran Aman Midtrans & Xendit
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" /> Token Otomatis Aktif Real-Time
              </span>
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-slate-500" /> QRIS (GoPay, OVO, Dana, ShopeePay), VA & Kartu
              </span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PricingModal;
