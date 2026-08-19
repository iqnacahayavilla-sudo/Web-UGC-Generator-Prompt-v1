import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Wand2, Copy, Clapperboard, ArrowRight, Play,
  Camera, MessageSquareText, ScanSearch, Sparkles, CheckCircle2,
  Video, Layers, Zap, Check, Crown, BookOpen, GraduationCap,
  PlayCircle, HelpCircle, Shield, ChevronRight, X, ExternalLink,
  Coins, Lock, FileText, User
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

const HERO_IMG = "https://images.unsplash.com/photo-1759393852314-59dc00faeed3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwzfHxjcmVhdG9yJTIwcmVjb3JkaW5nJTIwdmlkZW8lMjBzbWFydHBob25lfGVufDB8fHx8MTc4NjgyMzE5MXww&ixlib=rb-4.1.0&q=85";

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
  { q: "Bagaimana cara kerja reset token harian 00:00 WIB?", a: "Kredit harian akan kembali penuh ke kuota paket Anda tepat pada tengah malam waktu Indonesia Barat (00:00 WIB). Anda juga bisa membeli paket top up jika butuh token cadangan yang tidak pernah kedaluwarsa." },
  { q: "Alat AI Video apa saja yang didukung?", a: "Hasil prompt dioptimalkan secara presisi untuk Google Flow, serta sangat kompatibel dengan berbagai text-to-video AI generator modern seperti Sora, Runway Gen-3, Kling, dan Luma Dream Machine." },
  { q: "Apakah akun saya bisa dipakai bersama tim?", a: "Untuk akun Pro dan Enterprise, Anda dapat menggunakannya bersama tim atau menghubungi Admin untuk kebutuhan kuota agensi yang lebih besar." },
];

export default function Landing() {
  const { totalCredits, dailyRemaining, dailyQuota, bonusCredits, planType, openPricingModal } = useCredits();
  const { user, profile, isAdmin } = useAuth();
  const [selectedModule, setSelectedModule] = useState(null);

  const memberName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Kreator Sinergi";

  return (
    <div id="top" className="min-h-screen bg-background text-foreground transition-colors duration-200 selection:bg-primary/20 selection:text-primary">
      <Navbar />

      {/* MEMBER DASHBOARD & HERO SECTION */}
      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[250px] sm:h-[300px] bg-primary/10 dark:bg-primary/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 sm:py-12">
          {/* Member Welcome Card */}
          <div className="rounded-3xl border border-border/80 bg-card/90 p-5 sm:p-8 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Column: Greeting & Status */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Private Member Area
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                    <Crown className="h-3 w-3" /> Paket {planType || "free"}
                  </span>
                  {isAdmin && (
                    <Link to="/admin">
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                        <Shield className="h-3 w-3" /> Admin Portal
                      </span>
                    </Link>
                  )}
                </div>

                <div>
                  <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                    Halo, <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-blue-400 dark:to-cyan-300">{memberName}</span> 👋
                  </h1>
                  <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                    Selamat datang di portal pembuatan prompt video UGC otomatis <strong>Sinergi Visual</strong>. Siapkan foto produk Anda dan ekspor prompt profesional ke Google Flow.
                  </p>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                    <Zap className="h-4 w-4 text-primary fill-primary" />
                    <div>
                      <span className="font-semibold text-foreground">Kredit Harian:</span>{" "}
                      <span className="font-bold text-primary">{dailyRemaining} / {dailyQuota} Token</span>
                    </div>
                  </div>
                  {bonusCredits > 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>+{bonusCredits} Token Cadangan</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: High-Impact Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <Link to="/create" data-testid="member-open-generator-btn">
                  <Button className="h-14 w-full gap-2.5 rounded-2xl px-8 text-base font-bold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                    <Sparkles className="h-5 w-5" />
                    <span>Buka Tool Generator Prompt</span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>

                <div className="flex gap-2">
                  <a href="#pembelajaran" className="flex-1">
                    <Button variant="outline" className="h-11 w-full gap-2 rounded-xl text-xs font-semibold border-border hover:bg-secondary">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span>Area Pembelajaran</span>
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl text-xs font-semibold border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                    onClick={openPricingModal}
                  >
                    <Crown className="h-4 w-4" />
                    <span className="hidden sm:inline">Paket Token</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AREA PEMBELAJARAN (MATERI & VIDEO PANDUAN) */}
      <section id="pembelajaran" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:px-8 sm:py-20">
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

      {/* CARA KERJA STUDIO */}
      <section id="cara-kerja" className="border-y border-border/80 bg-secondary/20 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Alur Kerja Generator</span>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">4 Tahap Pembuatan Prompt Otomatis</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Dari satu foto produk menjadi naskah dan prompt video siap pakai dalam hitungan detik.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-1">
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
      <section className="py-14 sm:py-20 border-b border-border/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8">
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

      {/* CONTOH PROMPT PREVIEW */}
      <section id="contoh" className="bg-secondary/15 py-14 sm:py-20 border-b border-border/80">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:gap-10 px-4 sm:px-6 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Preview Output</span>
            <h2 className="mt-1.5 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Contoh Prompt Video UGC</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Struktur prompt yang komprehensif menjaga konsistensi wajah, pakaian, dan kemasan produk di semua adegan.</p>

            <div className="mt-5 space-y-2.5 rounded-xl border border-border/80 bg-card p-4 sm:p-5 text-xs sm:text-sm text-muted-foreground shadow-sm">
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Produk:</span> <span>Serum Skincare Glow</span></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Gaya:</span> <span>Masalah → Solusi (10 Detik)</span></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Kreator:</span> <span>Perempuan, 20-an</span></div>
              <div className="flex justify-between"><span className="font-medium text-foreground">Bahasa:</span> <span>Bahasa Indonesia (Santai)</span></div>
            </div>

            <Link to="/create" className="inline-block w-full sm:w-auto">
              <Button className="mt-6 h-12 w-full sm:w-auto gap-2 rounded-xl px-6 font-semibold">
                <span>Coba dengan Produk Anda</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 sm:px-5 py-3 font-display text-xs font-bold tracking-wider text-foreground">
              <span>OUTPUT PROMPT GOOGLE FLOW</span>
              <span className="text-primary font-mono text-[11px]">100% READY</span>
            </div>
            <pre className="font-mono-prompt max-h-[360px] sm:max-h-[420px] overflow-auto whitespace-pre-wrap p-4 sm:p-5 text-[11px] sm:text-[12px] leading-relaxed text-muted-foreground">
              {SAMPLE_PROMPT}
            </pre>
          </div>
        </div>
      </section>

      {/* PRICING & KUOTA TOKEN */}
      <section id="paket" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Sistem Kuota Token</span>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">Paket Langganan & Kuota Harian</h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Setiap paket mendapatkan kuota reset otomatis pukul 00:00 WIB setiap hari.</p>
        </div>

        <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Free */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Free Kreator</h3>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">MEMBER</span>
              </div>
              <div className="mt-4 font-display text-2xl sm:text-3xl font-extrabold">Rp 0</div>
              <div className="mt-2 text-xs text-primary font-bold flex items-center gap-1.5">
                <Zap className="h-4 w-4 fill-primary shrink-0" /> 100 Token / Hari (Reset 00:00 WIB)
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> 100 Token Generator / Hari</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Reset Otomatis 00:00 WIB</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Akses Seluruh Modul Pembelajaran</li>
              </ul>
            </div>
            <Link to="/create" className="mt-6">
              <Button variant="outline" className="w-full h-11 rounded-xl font-bold">Buka Generator</Button>
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 sm:p-6 shadow-xl relative flex flex-col justify-between md:scale-[1.02]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-3.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md">
              Paling Populer
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Pro Kreator</h3>
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div className="mt-4 font-display text-2xl sm:text-3xl font-extrabold">Rp 99.000 <span className="text-xs font-normal text-muted-foreground">/ bulan</span></div>
              <div className="mt-2 text-xs text-primary font-bold flex items-center gap-1.5">
                <Zap className="h-4 w-4 fill-primary shrink-0" /> 1.000 Token / Hari (Reset 00:00 WIB)
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> 1.000 Token Generator / Hari</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Prioritas Antrean Tercepat</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Fitur Konsistensi Karakter Lanjutan</li>
              </ul>
            </div>
            <Button className="mt-6 w-full h-11 rounded-xl font-bold shadow-md" onClick={openPricingModal}>Upgrade ke Pro</Button>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Enterprise Studio</h3>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">AGENSI</span>
              </div>
              <div className="mt-4 font-display text-2xl sm:text-3xl font-extrabold">Rp 299.000 <span className="text-xs font-normal text-muted-foreground">/ bulan</span></div>
              <div className="mt-2 text-xs text-primary font-bold flex items-center gap-1.5">
                <Zap className="h-4 w-4 fill-primary shrink-0" /> 5.000 Token / Hari (Reset 00:00 WIB)
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> 5.000 Token Generator / Hari</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Kolaborasi Multi-User & Tim</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Integrasi API & Webhook Kustom</li>
              </ul>
            </div>
            <Button variant="outline" className="mt-6 w-full h-11 rounded-xl font-bold" onClick={openPricingModal}>Hubungi Admin</Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:px-8 sm:py-20 border-t border-border/80">
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          <Logo clickable={false} size="sm" />
          <div>
            &copy; {new Date().getFullYear()} Sinergi Visual UGC Generator Prompt. Private Member Portal.
          </div>
        </div>
      </footer>
    </div>
  );
}
