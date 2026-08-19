import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Wand2, Copy, Clapperboard, ArrowRight, Play,
  Camera, MessageSquareText, ScanSearch, Sparkles, CheckCircle2,
  Video, Layers, Zap, Check, Crown, BookOpen, GraduationCap,
  Shield, ChevronRight, X, ExternalLink, Coins, Lock, FileText,
  User, MessageCircle, ShieldCheck, Flame, Tag, CheckCheck,
  History, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { useCredits } from "@/context/CreditContext";
import { useAuth } from "@/context/AuthContext";
import { SAMPLE_PROMPT } from "@/lib/sample";
import { supabase } from "@/lib/supabaseClient";

// Modul Pembelajaran Khusus Member
const LEARNING_MODULES = [
  {
    id: 1,
    title: "Workflow Ekspor Prompt UGC ke Google Flow",
    category: "Google Flow Mastery",
    duration: "5 Menit",
    badge: "Utama",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    desc: "Panduan langkah demi langkah menyalin Master Prompt dan Scene Prompt ke Google Flow agar menghasilkan video vertikal 9:16 ala rekaman smartphone asli.",
    content: [
      "1. Buka halaman hasil generate prompt di Sinergi Visual Studio.",
      "2. Klik tombol 'Salin Prompt Master' di pojok kanan atas.",
      "3. Buka platform Google Flow (atau AI Video Generator pilihan Anda).",
      "4. Tempelkan Master Prompt ke kolom teks utama, atur rasio 9:16 dan durasi sesuai pilihan.",
      "5. Tempelkan rincian Scene 1 hingga Scene terakhir untuk mempertahankan konsistensi visual.",
      "6. Tekan Generate Video dan download hasilnya dalam kualitas Full HD."
    ],
    tips: "Gunakan parameter negative constraints yang sudah disertakan agar terhindar dari tampilan CGI yang kaku."
  },
  {
    id: 2,
    title: "Formula Prompt Multi-Adegan di Sora & Runway Gen-3",
    category: "Advanced Video AI",
    duration: "7 Menit",
    badge: "Populer",
    thumbnail: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=600&auto=format&fit=crop&q=80",
    desc: "Cara memecah video 15-30 detik menjadi adegan dinamis dengan gerakan kamera selfie, close-up produk, dan ekspresi wajah yang meyakinkan.",
    content: [
      "1. Adegan Hook (0-3s): Sudut selfie eye-level dengan ekspresi penasaran/relatable.",
      "2. Adegan Cerita Masalah (3-8s): Medium shot dengan gestur santai menceritakan keluhan umum.",
      "3. Adegan Solusi Produk (8-16s): Close-up tekstur produk saat pertama kali dipegang kreator.",
      "4. Adegan Demonstrasi (16-24s): Praktik pemakaian nyata yang memperlihatkan fungsionalitas utama.",
      "5. Adegan Testimoni & CTA (24-30s): Ajakan beli ramah dengan menunjuk ke link keranjang kuning."
    ],
    tips: "Setiap perpindahan adegan gunakan cut transisi natural seperti 'match cut' atau 'fast whip pan'."
  },
  {
    id: 3,
    title: "Menjaga Konsistensi Wajah & Kemasan (Character Lock)",
    category: "Character Continuity",
    duration: "6 Menit",
    badge: "Penting",
    thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80",
    desc: "Metode mengunci identitas wajah kreator, gaya pakaian, dan detail kemasan produk agar 100% konsisten dari adegan pertama hingga penutup.",
    content: [
      "1. Aktifkan toggle 'Gunakan Karakter yang Sama' saat melakukan regenerasi prompt.",
      "2. Prompt kami menyertakan 'Character Bible' yang mendefinisikan usia, model rambut, dan outfit.",
      "3. Prompt produk mengunci warna kemasan, logo, dan material botol/wadah.",
      "4. Jangan ubah deskripsi fisik kreator di tengah-tengah proses generate adegan."
    ],
    tips: "Simpan Character Anchor unik yang dihasilkan sistem untuk dipakai pada video promosi produk berikutnya."
  },
  {
    id: 4,
    title: "Struktur Naskah Dialog Percakapan & Hook 3 Detik",
    category: "Copywriting UGC",
    duration: "4 Menit",
    badge: "Viral Formula",
    thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80",
    desc: "Strategi memilih gaya bahasa sehari-hari yang santai, menghindari jargon iklan kaku, dan memicu rasa penasaran penonton sejak detik pertama.",
    content: [
      "1. Hook Kalimat Tanya: 'Kalian ngerasa gak sih kalau produk X sering banget...' ",
      "2. Hook Masalah Relatable: 'Jujur aku dulu sering banget buang duit buat...'",
      "3. Hook Rahasia / Unboxing: 'Akhirnya paket yang aku tunggu-tunggu seminggu ini sampai juga!'",
      "4. Hindari bahasa yang terdengar seperti pembaca berita; gunakan gaya bahasa teman curhat."
    ],
    tips: "Aktifkan opsi 'Bahasa Percakapan Santai (Natural Slang)' di Step 3 studio generator."
  }
];

// PROMPT VAULT: Bonus Master Prompt Niche Terlaris Siap Pakai (1-Click Copy)
const PROMPT_VAULT = [
  {
    id: "skincare-01",
    niche: "Skincare & Beauty",
    badge: "Viral Niche 🔥",
    title: "Serum Glass Skin Glow — Problem to Solution Formula",
    duration: "15 Detik",
    ratio: "9:16 Vertical",
    hook: "Kalian ngerasa gak sih kalau kulit kusam tuh bikin insecure seharian?",
    promptText: `[MASTER UGC VIDEO PROMPT - SKINCARE GLOW SERUM - 15s]
Format: Vertical 9:16, 15 seconds, authentic TikTok/Reels mobile camera aesthetic, natural soft morning window lighting.
Creator Anchor: Female in her early 20s, radiant dewy bare face, casual pastel hoodie, hair in a messy bun, talking warmly directly to camera.
Product Lock: Frosted glass dropper bottle with minimalist white label 'Glow Radiance Serum', golden liquid texture with light reflections.

[SCENE BREAKDOWN]
- Scene 1 (0-3s) [HOOK]: Close-up selfie angle of creator pointing to her glowing cheek with an expressive excited smile. Audio: "Kalian ngerasa gak sih kalau kulit kusam tuh bikin insecure seharian? Untung nemu serum ini!"
- Scene 2 (3-9s) [DEMO & TEXTURE]: Macro shot of 2 drops of serum dropped onto the back of the hand, smooth silky spread with glass-like finish. Audio: "Teksturnya super ringan, cepat meresap, gak lengket sama sekali!"
- Scene 3 (9-15s) [CTA]: Creator holds product bottle next to smiling face, gently tapping the bottom of the screen. Audio: "Buruan checkout di keranjang kuning mumpung lagi diskon!"

[NEGATIVE CONSTRAINTS]: No CGI smoothness, no robotic AI voice, no stiff studio tripod framing, no artificial gloss.`,
  },
  {
    id: "fashion-02",
    niche: "Fashion & Outfit",
    badge: "High Converting 👗",
    title: "OOTD Streetwear Minimalist — Dynamic Mirror Selfie & Fast Cut",
    duration: "20 Detik",
    ratio: "9:16 Vertical",
    hook: "Spill outfit ngantor tapi tetap kelihatan estetik & effortless!",
    promptText: `[MASTER UGC VIDEO PROMPT - STREETWEAR OOTD - 20s]
Format: Vertical 9:16, 20 seconds, handheld smartphone vlog style, aesthetic modern bedroom with warm ambient sunlight.
Creator Anchor: Trendy male/female (22-26yo), stylish haircut, minimalist gold accessories, confident engaging smile.
Product Lock: Premium oversized boxy tee in washed charcoal grey and relaxed pleated trousers.

[SCENE BREAKDOWN]
- Scene 1 (0-4s) [HOOK]: Mirror selfie full body zoom in with natural phone reflection. Audio: "Spill outfit ngantor tapi tetap kelihatan estetik & effortless!"
- Scene 2 (4-12s) [FABRIC DETAIL]: Close-up tactile touch of the heavy cotton 24s texture, neat stitch hems, and breathable drape. Audio: "Bahannya tebal 24s combed tapi adem pol seharian!"
- Scene 3 (12-20s) [STYLING & CTA]: 3 quick snap transitions showcasing tucked-in, layered jacket, and casual look. Audio: "Link ada di bio / keranjang kuning sekarang ya!"

[NEGATIVE CONSTRAINTS]: No studio spotlight flash, no distorted proportions, no cinematic Hollywood grading, keep casual UGC raw realism.`,
  },
  {
    id: "gadget-03",
    niche: "Gadget & Aksesoris",
    badge: "Best Seller 📱",
    title: "Smart Tumbler / Wireless Gadget — Feature Breakdown & Unboxing",
    duration: "30 Detik",
    ratio: "9:16 Vertical",
    hook: "Benda kecil ini ternyata ngebantu banget buat naikin produktivitas kerja!",
    promptText: `[MASTER UGC VIDEO PROMPT - SMART WATER BOTTLE & ACCESSORY - 30s]
Format: Vertical 9:16, 30 seconds, clean minimalist desk setup, warm daylight lamp, POV handheld camera angle.
Creator Anchor: Tech-savvy creator in 20s, casual neutral crewneck, articulate expressive communication.
Product Lock: Matte black thermal bottle with digital LED temperature touch screen on cap.

[SCENE BREAKDOWN]
- Scene 1 (0-5s) [HOOK]: Creator taps digital cap displaying temperature in vibrant blue LED. Audio: "Benda kecil ini ternyata ngebantu banget buat naikin produktivitas harian!"
- Scene 2 (5-15s) [FEATURE DEMO]: Creator pours iced water, shakes bottle, demonstrates zero leak seal and shows ice cubes remaining after 12 hours. Audio: "Tahan dingin sampai 24 jam dan ada smart reminder buat minum."
- Scene 3 (15-25s) [DAILY LIFESTYLE]: Creator slipping tumbler smoothly into backpack side pocket in cafe. Audio: "Desainnya super slim, elegan dibawa meeting atau ngantor."
- Scene 4 (25-30s) [CTA]: Creator thumbs up next to tumbler box packaging. Audio: "Mumpung free ongkir, langsung amankan sebelum sold out!"

[NEGATIVE CONSTRAINTS]: No 3D render look, maintain authentic handheld wobble, clear sound cues.`,
  },
  {
    id: "fnb-04",
    niche: "Food & Beverage",
    badge: "Trending ASMR ☕",
    title: "Artisan Coffee / Snack — Aesthetic ASMR Taste Test",
    duration: "15 Detik",
    ratio: "9:16 Vertical",
    hook: "Jujur gak nyangka kopi sachet ini rasanya bisa semirip kafe mahal!",
    promptText: `[MASTER UGC VIDEO PROMPT - ARTISAN COFFEE & SNACK - 15s]
Format: Vertical 9:16, 15 seconds, aesthetic kitchen marble countertop, soft afternoon sunlight, crisp ASMR ambient audio.
Creator Anchor: Lifestyle foodie creator (20s), relaxed comfy knitwear, authentic genuine delighted facial reaction.
Product Lock: Minimalist craft pouch with golden embossed typography 'Artisan Drip Coffee'.

[SCENE BREAKDOWN]
- Scene 1 (0-3s) [HOOK]: Close-up pour of rich golden crema coffee into clear double-wall glass with clinking ice. Audio: "Jujur gak nyangka kopi ini rasanya semirip kafe mahal!"
- Scene 2 (3-9s) [TASTE REACTION]: First sip close-up reaction, eyes widening in genuine appreciation. Audio: "Bold, gak asam di lambung, dan aromanya beneran semerbak banget."
- Scene 3 (9-15s) [CTA]: Showing the box bundle packaging with discount sticker. Audio: "Cobain sendiri, klik keranjang di bawah ya!"

[NEGATIVE CONSTRAINTS]: No generic stock footage, ensure crisp high definition textures and appetizing lighting.`,
  }
];

const STEPS = [
  { icon: Upload, title: "Upload Foto Produk", desc: "Cukup satu foto produk jernih — tanpa perlu keahlian desain grafis." },
  { icon: Wand2, title: "Tentukan Gaya & Kreator", desc: "Pilih gaya UGC, persona kreator, durasi, dan bahasa yang kamu inginkan." },
  { icon: Sparkles, title: "AI Generate Prompt", desc: "Sistem kecerdasan buatan menyusun prompt lengkap per adegan dan dialog." },
  { icon: Copy, title: "Salin ke Google Flow", desc: "Tinggal satu klik salin, lalu tempelkan langsung ke Google Flow atau AI video generator." },
];

const UGC_STYLES = [
  "Ngomong Langsung ke Kamera", "Review Produk", "Unboxing", "Masalah → Solusi",
  "Jualan Soft", "POV", "Storytelling", "Demo Produk", "Sebelum → Sesudah",
];

const FAQ = [
  { q: "Apa itu Sinergi Visual UGC Generator Prompt?", a: "Sinergi Visual UGC Generator Prompt adalah platform cerdas untuk mengubah satu foto produk menjadi prompt video UGC lengkap yang siap digunakan di AI Video Generator seperti Google Flow, Sora, Runway Gen-3, Kling, dan lainnya." },
  { q: "Bagaimana cara kerja reset token harian 00:00 WIB?", a: "Kredit harian akan kembali penuh ke kuota Anda tepat pada tengah malam waktu Indonesia Barat (00:00 WIB). Anda juga dapat melakukan isi ulang saldo permanen via WhatsApp Admin." },
  { q: "Alat AI Video apa saja yang didukung?", a: "Hasil prompt dioptimalkan secara presisi untuk Google Flow, serta sangat kompatibel dengan berbagai text-to-video AI generator modern seperti Sora, Runway Gen-3, Kling, dan Luma Dream Machine." },
  { q: "Bagaimana cara klaim bonus atau isi ulang kredit token?", a: "Khusus private member terdaftar, Anda dapat langsung menghubungi WhatsApp VIP Support untuk penambahan kuota token tanpa batas." },
];

export default function Landing() {
  const { totalCredits, dailyRemaining, dailyQuota, bonusCredits, planType } = useCredits();
  const { user, profile, isAdmin } = useAuth();
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [copiedPromptId, setCopiedPromptId] = useState(null);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);

  const memberName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Kreator Sinergi";

  // Hitung riwayat proyek member dari Supabase/Database
  useEffect(() => {
    async function loadStats() {
      if (user?.id) {
        try {
          const { count, error } = await supabase
            .from("projects")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          if (!error && typeof count === "number") {
            setTotalProjectsCount(count);
          }
        } catch (e) {
          // fallback
        }
      }
    }
    loadStats();
  }, [user]);

  const handleCopyPrompt = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const filteredVault = selectedNiche === "all"
    ? PROMPT_VAULT
    : PROMPT_VAULT.filter((p) => p.niche.toLowerCase().includes(selectedNiche.toLowerCase()));

  // Link WhatsApp VIP Support / Isi Ulang
  const waSupportUrl = `https://wa.me/6281234567890?text=${encodeURIComponent(
    `Halo Admin Sinergi Visual, saya member VIP (${user?.email || memberName}). Saya ingin konsultasi & isi ulang token kredit prompt video UGC.`
  )}`;

  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-200 selection:bg-primary/20 selection:text-primary">
      <Navbar />

      {/* MEMBER DASHBOARD & QUICK STATS SECTION */}
      <section className="relative overflow-x-hidden border-b border-border/80 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 sm:h-80 bg-primary/15 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 sm:py-14 md:py-16">
          {/* Header Greeting Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/70 pb-7 mb-8 sm:mb-10">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-extrabold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Private Member Area
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Crown className="h-3 w-3" /> VIP Access
                </span>
                {isAdmin && (
                  <Link to="/admin">
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <Shield className="h-3 w-3" /> Super Admin Portal
                    </span>
                  </Link>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Selamat Datang, <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-blue-400 dark:to-cyan-300">{memberName}</span> 👋
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Portal pembuatan prompt video UGC AI otomatis & arsip template terlaris siap pakai.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/create" data-testid="hero-create-btn" className="w-full sm:w-auto">
                <Button className="h-12 sm:h-13 w-full sm:w-auto gap-2 rounded-xl px-6 font-bold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                  <Sparkles className="h-4 w-4" />
                  <span>Buka Studio Generator</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* 3 QUICK STATS CARD (WIDGET MEMBER VIP) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Widget 1: Status Akun */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-6 sm:p-7 shadow-sm flex flex-col justify-between transition-all hover:border-emerald-500/40 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status Keanggotaan</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-display text-xl sm:text-2xl font-extrabold text-foreground">VIP Active Member</span>
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Akun Terverifikasi
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Akses penuh ke seluruh model AI vision generator, formula multi-adegan, dan video panduan eksklusif.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Masa Aktif:</span>
                <span className="font-semibold text-foreground">Unlimited / Lifetime</span>
              </div>
            </div>

            {/* Widget 2: Kredit Token */}
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-6 sm:p-7 shadow-md flex flex-col justify-between relative">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Saldo Kredit Token</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Zap className="h-4 w-4 fill-primary" />
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                  {totalCredits} <span className="text-base font-normal text-muted-foreground">Token</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">• {dailyRemaining} / {dailyQuota} Kuota Harian</span>
                  {bonusCredits > 0 && (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">• +{bonusCredits} Cadangan</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Kuota harian di-reset otomatis setiap pukul 00:00 WIB (GMT+7).
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-primary/20">
                <a
                  href={waSupportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full h-10 gap-2 rounded-xl text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm transition-all"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Isi Ulang Khusus Member</span>
                    <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Widget 3: Total Prompt Dibuat */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-6 sm:p-7 shadow-sm flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Prompt Dibuat</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Clapperboard className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                  {totalProjectsCount > 0 ? `${totalProjectsCount} Video` : "Siap Dibuat"}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> Google Flow & Sora Ready
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Setiap prompt dilengkapi naskah dialog percakapan, hook 3 detik, dan pergerakan kamera handheld.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60">
                <Link to="/create">
                  <Button
                    variant="outline"
                    className="w-full h-10 gap-1.5 rounded-xl text-xs font-semibold hover:bg-secondary"
                  >
                    <span>Buka Studio Generator</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AREA PEMBELAJARAN (MATERI & VIDEO PANDUAN) */}
      <section id="pembelajaran" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <BookOpen className="h-4 w-4" /> Area Pembelajaran & Video Panduan
            </span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Panduan Menghasilkan Video UGC Viral
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Pelajari formula prompt, teknik kamera, konsistensi karakter, dan alur ekspor ke Google Flow, Sora, dan Runway Gen-3.
            </p>
          </div>
        </div>

        {/* Learning Modules Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {LEARNING_MODULES.map((mod) => (
            <div
              key={mod.id}
              onClick={() => setSelectedModule(mod)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm transition-all hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-secondary">
                  <img
                    src={mod.thumbnail}
                    alt={mod.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white shadow-sm">
                      {mod.badge}
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg backdrop-blur-sm group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2.5 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                    {mod.duration}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-5">
                  <div className="text-[11px] font-bold uppercase text-primary tracking-wider">{mod.category}</div>
                  <h3 className="mt-1 font-display text-sm sm:text-base font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {mod.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
                <div className="flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
                  <span>Pelajari Modul</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION: PROMPT VAULT (BONUS MASTER PROMPT NICHE TERLARIS) */}
      <section id="prompt-vault" className="border-y border-border/80 bg-secondary/15 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Flame className="h-4 w-4 text-amber-500 fill-amber-500" /> Prompt Vault (Bonus Siap Pakai)
              </span>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Master Prompt Niche Terlaris
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Koleksi prompt video UGC teruji konversi tinggi di berbagai niche produk terpopuler. Siap Anda salin 1-klik langsung ke Google Flow atau AI Video Generator.
              </p>
            </div>

            {/* Niche Filter Buttons */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-background/90 rounded-2xl border border-border/80 shadow-sm">
              {[
                { id: "all", label: "Semua Niche" },
                { id: "skincare", label: "Skincare" },
                { id: "fashion", label: "Fashion" },
                { id: "gadget", label: "Gadget" },
                { id: "fnb", label: "F&B / Kuliner" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedNiche(tab.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    selectedNiche === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm font-extrabold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Cards Grid */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredVault.map((item) => {
              const isCopied = copiedPromptId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="space-y-3.5">
                    {/* Badge row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
                        {item.badge}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        <span className="rounded-md bg-secondary/80 px-2 py-0.5 font-semibold">{item.duration}</span>
                        <span className="rounded-md bg-secondary/80 px-2 py-0.5 font-semibold">{item.ratio}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">{item.niche}</span>
                      <h3 className="mt-1 font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                        {item.title}
                      </h3>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">🔥 Hook Pembuka:</span>{" "}
                      <span className="text-slate-600 dark:text-slate-300 italic">"{item.hook}"</span>
                    </div>

                    <div className="relative overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto select-all">
                      <pre className="whitespace-pre-wrap font-sans">{item.promptText}</pre>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2.5">
                    <Button
                      onClick={() => handleCopyPrompt(item.id, item.promptText)}
                      className={`flex-1 h-10 sm:h-11 gap-1.5 sm:gap-2 rounded-xl text-xs font-bold transition-all ${
                        isCopied
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                      }`}
                    >
                      {isCopied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{isCopied ? "Tersalin!" : "Salin Prompt (1-Click)"}</span>
                    </Button>

                    <Link to="/create">
                      <Button variant="outline" className="h-10 sm:h-11 rounded-xl px-3.5 text-xs font-semibold gap-1 hover:bg-secondary">
                        <span>Buat Serupa</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CARA KERJA STUDIO */}
      <section id="cara-kerja" className="py-14 sm:py-20 border-b border-border/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Alur Kerja Generator</span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">4 Tahap Pembuatan Prompt Otomatis</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Dari satu foto produk menjadi naskah dan prompt video siap pakai dalam hitungan detik.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-5 sm:p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-1">
                <span className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <div className="mt-4 sm:mt-5 text-xs font-bold tracking-wider text-muted-foreground">LANGKAH 0{i + 1}</div>
                <h3 className="mt-1 font-display text-base sm:text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center sm:text-left">
            <Link to="/create">
              <Button className="h-12 gap-2 rounded-xl px-6 font-bold shadow-md">
                <Sparkles className="h-4 w-4" />
                <span>Mulai Buat Prompt Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* GAYA UGC CHIPS */}
      <section className="py-14 sm:py-20 border-b border-border/80 bg-secondary/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Koleksi Formula & Gaya Video UGC</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Pilih formula video yang paling sesuai dengan tujuan konversi produk Anda.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {UGC_STYLES.map((s) => (
              <span
                key={s}
                className="rounded-xl border border-border bg-card px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 sm:py-20 border-t border-border/80">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Tanya Jawab</span>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Pertanyaan Umum Member</h2>
        </div>
        <Accordion type="single" collapsible className="mt-6 space-y-2">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} data-testid={`faq-${i}`} className="border rounded-xl px-3 sm:px-4 bg-card">
              <AccordionTrigger className="text-left font-display text-sm sm:text-base font-semibold py-3.5 sm:py-4 hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-xs sm:text-sm text-muted-foreground pb-3.5 sm:pb-4 leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* MODAL DETAIL PEMBELAJARAN */}
      {selectedModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
              <div>
                <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase text-primary">
                  {selectedModule.category}
                </span>
                <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-foreground">
                  {selectedModule.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModule(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs sm:text-sm leading-relaxed">
              <p className="text-muted-foreground font-medium">
                {selectedModule.desc}
              </p>

              <div className="rounded-2xl border border-border bg-secondary/30 p-4 sm:p-5">
                <div className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Langkah Praktik:</span>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  {selectedModule.content.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400">
                <span className="font-bold">💡 Tips Ahli:</span> {selectedModule.tips}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/80">
              <Link to="/create" className="flex-1" onClick={() => setSelectedModule(null)}>
                <Button className="h-11 w-full gap-2 rounded-xl font-bold">
                  <Sparkles className="h-4 w-4" />
                  <span>Praktikkan di Tool Generator</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => setSelectedModule(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-border/80 py-8 sm:py-10 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          <Logo clickable={false} size="sm" />
          <div className="flex items-center gap-4">
            <a
              href={waSupportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>VIP Member WhatsApp Support</span>
            </a>
            <span>•</span>
            <div>
              &copy; {new Date().getFullYear()} Sinergi Visual. Private Member Portal.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
