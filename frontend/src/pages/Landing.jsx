import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Upload, Wand2, Copy, Clapperboard, ArrowRight, Play,
  Camera, MessageSquareText, ScanSearch, Sparkles, CheckCircle2,
  Video, Layers, Zap, Check, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { useCredits } from "@/context/CreditContext";
import { SAMPLE_PROMPT } from "@/lib/sample";

const HERO_IMG = "https://images.unsplash.com/photo-1759393852314-59dc00faeed3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwzfHxjcmVhdG9yJTIwcmVjb3JkaW5nJTIwdmlkZW8lMjBzbWFydHBob25lfGVufDB8fHx8MTc4NjgyMzE5MXww&ixlib=rb-4.1.0&q=85";

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

const FEATURES = [
  { icon: ScanSearch, title: "Analisis Produk AI Otomatis", desc: "AI membaca foto produk dan mengekstrak detail bahan, warna, kemasan, dan nilai jual secara otomatis." },
  { icon: Clapperboard, title: "Struktur Skrip Multi-Adegan", desc: "Setiap prompt dilengkapi rincian visual, pergerakan kamera, audio, ekspresi wajah, dan naskah dialog percakapan." },
  { icon: Camera, title: "Nuansa UGC Smartphone Autentik", desc: "Diformulasikan khusus menyerupai rekaman kamera HP kreator asli yang natural dan terpercaya." },
  { icon: MessageSquareText, title: "Dialog Percakapan Alami", desc: "Pilihan bahasa percakapan sehari-hari dalam Bahasa Indonesia, Inggris, atau Melayu." },
];

const FAQ = [
  { q: "Apa itu Sinergi Visual UGC Generator Prompt?", a: "Sinergi Visual UGC Generator Prompt adalah platform cerdas untuk mengubah satu foto produk menjadi prompt video UGC lengkap yang siap digunakan di AI Video Generator seperti Google Flow, Sora, Runway Gen-3, Kling, dan lainnya." },
  { q: "Berapa banyak token kredit gratis yang saya dapatkan?", a: "Setiap pengguna mendapatkan 100 Token Gratis setiap hari yang di-reset otomatis setiap pukul 00:00 WIB (GMT+7), ditambah bonus sambutan 10 token permanen." },
  { q: "Bagaimana cara kerja reset token harian 00:00 WIB?", a: "Kredit harian akan kembali penuh ke kuota paket Anda tepat pada tengah malam waktu Indonesia Barat (00:00 WIB). Anda juga bisa membeli paket top up jika butuh token cadangan yang tidak pernah kedaluwarsa." },
  { q: "Apakah saya harus memahami prompt engineering?", a: "Tidak perlu sama sekali. Anda hanya perlu mengunggah foto produk dan memilih opsi pengaturan video. AI kami yang akan menyusun prompt profesional berstandar industri." },
  { q: "Alat AI Video apa saja yang didukung?", a: "Hasil prompt dioptimalkan secara presisi untuk Google Flow, serta sangat kompatibel dengan berbagai text-to-video AI generator modern lainnya." },
];

export default function Landing() {
  const { openPricingModal } = useCredits();

  return (
    <div id="top" className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-border/80">
        <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[250px] sm:h-[300px] bg-primary/10 dark:bg-primary/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 sm:gap-12 px-4 py-12 sm:px-6 md:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Sinergi Visual AI Prompt Studio
            </span>

            <h1 className="mt-4 sm:mt-5 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-foreground">
              Ubah Foto Produk Jadi <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-blue-400 dark:to-cyan-300">Prompt Video UGC</span>
            </h1>

            <p className="mt-3 sm:mt-5 max-w-lg text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
              Platform otomatis <strong>Sinergi Visual</strong> untuk menghasilkan prompt video UGC ala kreator profesional siap pakai di Google Flow dan AI video generator.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-3.5 w-full sm:w-auto">
              <Link to="/create" className="w-full sm:w-auto" data-testid="hero-create-btn">
                <Button className="h-13 sm:h-14 w-full sm:w-auto gap-2.5 rounded-xl px-6 sm:px-7 text-sm sm:text-base font-semibold shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
                  <Sparkles className="h-4 sm:h-5 w-4 sm:w-5" />
                  <span>Buat Prompt Sekarang</span>
                  <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="h-13 sm:h-14 w-full sm:w-auto rounded-xl px-6 sm:px-7 text-sm sm:text-base font-medium border-border/80 hover:bg-secondary/80"
                onClick={openPricingModal}
                data-testid="hero-pricing-btn"
              >
                <Zap className="h-4 w-4 mr-2 text-primary" /> Lihat Paket Kredit
              </Button>
            </div>

            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> 100 Token Gratis / Hari
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Reset Otomatis 00:00 WIB
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> Siap Salin ke AI Video
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl">
              <img src={HERO_IMG} alt="Kreator merekam video UGC Sinergi Visual" className="aspect-[4/5] w-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -left-4 hidden max-w-[240px] rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md sm:block">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Sparkles className="h-4 w-4" /> Prompt Siap Pakai
              </div>
              <p className="mt-1 font-mono-prompt text-[11px] leading-snug text-muted-foreground">
                SCENE 1 — HOOK · 0–3s · Smartphone POV handheld selfie...
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CARA KERJA */}
      <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:px-8 sm:py-20">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Langkah Mudah</span>
          <h2 className="mt-1.5 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Cara Kerja Sinergi Visual</h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">Dari satu foto produk menjadi naskah dan prompt video siap pakai dalam 4 tahap terpadu.</p>
        </div>

        <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
      </section>

      {/* GAYA UGC */}
      <section className="border-y border-border/80 bg-secondary/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 text-center sm:text-left">
          <div className="max-w-2xl mx-auto sm:mx-0">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Gaya Video UGC untuk Beragam Kategori</h2>
            <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">Pilih formula video yang paling sesuai dengan strategi pemasaran produk Anda — AI kami akan mengadaptasikan pacing dan narasinya.</p>
          </div>
          <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 justify-center sm:justify-start">
            {UGC_STYLES.map((s) => (
              <span
                key={s}
                className="rounded-xl border border-border bg-card px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-colors hover:border-primary/50"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CONTOH PROMPT */}
      <section id="contoh" className="border-b border-border/80 bg-secondary/15 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:gap-10 px-4 sm:px-6 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Preview Output</span>
            <h2 className="mt-1.5 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Contoh Prompt Video UGC</h2>
            <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">Struktur prompt yang komprehensif menjaga konsistensi wajah, pakaian, dan kemasan produk di semua adegan.</p>

            <div className="mt-5 sm:mt-6 space-y-2.5 rounded-xl border border-border/80 bg-card p-4 sm:p-5 text-xs sm:text-sm text-muted-foreground shadow-sm">
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Produk:</span> <span>Serum Skincare Glow</span></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Gaya:</span> <span>Masalah → Solusi (10 Detik)</span></div>
              <div className="flex justify-between border-b border-border/60 pb-2"><span className="font-medium text-foreground">Kreator:</span> <span>Perempuan, 20-an</span></div>
              <div className="flex justify-between"><span className="font-medium text-foreground">Bahasa:</span> <span>Bahasa Indonesia (Santai)</span></div>
            </div>

            <Link to="/create" className="inline-block w-full sm:w-auto">
              <Button className="mt-6 sm:mt-8 h-12 w-full sm:w-auto gap-2 rounded-xl px-6 font-semibold">
                <span>Coba dengan Produk Anda</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 sm:px-5 py-3 sm:py-3.5 font-display text-xs font-bold tracking-wider text-foreground">
              <span>OUTPUT PROMPT GOOGLE FLOW</span>
              <span className="text-primary font-mono text-[11px] sm:text-xs">100% READY</span>
            </div>
            <pre className="font-mono-prompt max-h-[380px] sm:max-h-[440px] overflow-auto whitespace-pre-wrap p-4 sm:p-5 text-[11px] sm:text-[12px] leading-relaxed text-muted-foreground">
              {SAMPLE_PROMPT}
            </pre>
          </div>
        </div>
      </section>

      {/* PRICING PLANS SECTION */}
      <section id="paket" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Sistem Monetisasi & Token</span>
          <h2 className="mt-1.5 font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">Paket Langganan & Kuota Harian</h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground">Mulai gratis dengan kuota 100 token setiap hari atau upgrade ke paket Pro untuk produksi video tanpa batas.</p>
        </div>

        <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Free */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Free Kreator</h3>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">GRATIS</span>
              </div>
              <div className="mt-4 font-display text-2xl sm:text-3xl font-extrabold">Rp 0</div>
              <div className="mt-2 text-xs text-primary font-bold flex items-center gap-1.5">
                <Zap className="h-4 w-4 fill-primary shrink-0" /> 100 Token / Hari (Reset 00:00 WIB)
              </div>
              <ul className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> 100 Token Generator / Hari</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Reset Otomatis 00:00 WIB</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Analisis Foto Produk AI</li>
              </ul>
            </div>
            <Link to="/create" className="mt-6 sm:mt-8">
              <Button variant="outline" className="w-full h-11 rounded-xl font-bold">Mulai Gratis</Button>
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
            <Button className="mt-6 sm:mt-8 w-full h-11 rounded-xl font-bold shadow-md" onClick={openPricingModal}>Upgrade ke Pro</Button>
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
            <Button variant="outline" className="mt-6 sm:mt-8 w-full h-11 rounded-xl font-bold" onClick={openPricingModal}>Hubungi Sales / Langganan</Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:px-8 sm:py-20 border-t border-border/80">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Tanya Jawab</span>
          <h2 className="mt-1.5 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Pertanyaan Umum</h2>
        </div>
        <Accordion type="single" collapsible className="mt-6 sm:mt-8 space-y-2">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} data-testid={`faq-${i}`} className="border rounded-xl px-3 sm:px-4 bg-card">
              <AccordionTrigger className="text-left font-display text-sm sm:text-base font-semibold py-3.5 sm:py-4 hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-xs sm:text-sm text-muted-foreground pb-3.5 sm:pb-4 leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA FOOTER */}
      <section className="border-t border-border/80 bg-gradient-to-b from-background to-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 md:px-8 sm:py-24">
          <h2 className="mx-auto max-w-2xl font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Siap Membuat Video UGC dari Produk Anda?
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            Dapatkan 100 Token gratis sekarang dan buat prompt video AI berstandar Google Flow dalam hitungan detik.
          </p>
          <Link to="/create" className="inline-block w-full sm:w-auto" data-testid="cta-create-btn">
            <Button className="mt-6 sm:mt-8 h-13 sm:h-14 w-full sm:w-auto gap-2.5 rounded-xl px-6 sm:px-9 text-sm sm:text-base font-semibold shadow-lg transition-transform hover:-translate-y-0.5">
              <Sparkles className="h-4 sm:h-5 w-4 sm:w-5" />
              <span>Mulai Buat Prompt UGC (Gratis)</span>
              <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/80 py-8 sm:py-10 bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          <Logo clickable={false} size="sm" />
          <div>
            &copy; {new Date().getFullYear()} Sinergi Visual UGC Generator Prompt. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
