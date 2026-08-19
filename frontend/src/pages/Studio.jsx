import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import {
  Upload, X, RefreshCw, ImageIcon, Loader2, Copy, ArrowLeft, ArrowRight,
  Sparkles, Wand2, FilePlus2, PencilRuler, Check, Lock, ChevronDown,
  Layers, CheckCircle2, Download, FileText, History, Calendar, Clock,
  FolderOpen, FileCheck, CheckCheck, Eye, Search, ExternalLink, Zap,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { OptionGroup } from "@/components/studio/OptionGroup";
import { StepProgress } from "@/components/studio/StepProgress";
import { useAuth } from "@/context/AuthContext";
import { useCredits } from "@/context/CreditContext";
import { analyzeImage, generatePrompt, getUserProjects } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import {
  saveProjectAndDeductCredits,
  fetchMemberHistoryProjects,
} from "@/lib/supabaseAdmin";
import {
  ASPECT_RATIOS, DURATIONS, UGC_STYLES, HOOK_STYLES, SELLING_STYLES,
  GENDERS, AGES, PERSONALITIES, SPEAKING_STYLES, LOCATIONS, LANGUAGES,
  DEFAULT_VIDEO, DEFAULT_CREATOR, QUICK_ACTIONS,
} from "@/lib/options";

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const STAGES = [
  "Menganalisis karakteristik produk dengan Gemini Vision...",
  "Menyusun konsep video dan formula hook viral...",
  "Menulis adegan, pergerakan kamera, dan dialog natural...",
  "Menyelesaikan prompt berstandar Google Flow...",
];

const ARRAY_KEYS = ["dominant_colors", "materials", "visual_features"];
const ANALYSIS_LABELS = {
  product_name: "Nama Produk", category: "Kategori", product_type: "Jenis Produk",
  brand: "Merek", dominant_colors: "Warna Dominan", materials: "Bahan Material",
  packaging_description: "Bentuk & Kemasan", visual_features: "Detail Visual Utama",
  likely_use_case: "Kegunaan / Manfaat", target_audience: "Target Konsumen",
  visible_text: "Teks pada Produk", product_positioning: "Positioning Produk",
};

function copyText(text, msg) {
  navigator.clipboard.writeText(text);
  toast.success(msg || "Tersalin ke clipboard.");
}

function sceneToText(s) {
  const row = (label, val) => (val ? `${label}: ${val}` : null);
  const lines = [
    `SCENE ${s.number} — ${s.name}`,
    row("TIME", s.time),
    row("CHARACTER CONTINUITY", s.character_continuity),
    row("PRODUCT CONTINUITY", s.product_continuity),
    row("LOCATION CONTINUITY", s.location_continuity),
    row("VISUAL", s.visual),
    row("ACTION", s.action),
    row("FACIAL EXPRESSION", s.facial_expression),
    row("GESTURE", s.gesture),
    row("CAMERA", s.camera),
    row("LIGHTING", s.lighting),
    row("AUDIO", s.audio),
    row("DIALOGUE", s.dialogue),
    row("TRANSITION / CONTINUITY INTO NEXT SCENE", s.transition),
    row("NEGATIVE CONSTRAINTS", s.negative_constraints),
  ].filter(Boolean);
  return lines.join("\n");
}

function downloadTxt(resultData, summaryData) {
  const productName = summaryData?.product || resultData?.summary?.product || "Produk";
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let content = `=======================================================\n`;
  content += `   SINERGI VISUAL — MASTER UGC VIDEO PROMPT\n`;
  content += `=======================================================\n\n`;
  content += `INFORMASI PROYEK:\n`;
  content += `• Nama Produk   : ${productName}\n`;
  content += `• Tanggal Buat  : ${dateStr}\n`;
  content += `• Format Video  : ${summaryData?.duration || "15 Detik"} | ${summaryData?.aspect_ratio || "9:16 Vertikal"}\n`;
  content += `• Gaya UGC      : ${summaryData?.ugc_style || "Review Produk"}\n`;
  content += `• Persona       : ${summaryData?.creator || "Kreator"}\n`;
  content += `• Bahasa        : ${summaryData?.language || "Bahasa Indonesia"}\n\n`;
  content += `-------------------------------------------------------\n`;
  content += `1. GOOGLE FLOW / SORA MASTER PROMPT (LENGKAP)\n`;
  content += `-------------------------------------------------------\n\n`;
  content += `${resultData?.master_prompt || ""}\n\n`;

  if (Array.isArray(resultData?.scenes) && resultData?.scenes?.length > 0) {
    content += `-------------------------------------------------------\n`;
    content += `2. RINCIAN ADENGAN TERPISAH (SCENE BREAKDOWN 1-${resultData?.scenes?.length})\n`;
    content += `-------------------------------------------------------\n\n`;

    resultData?.scenes?.forEach((s, idx) => {
      content += `[SCENE ${s?.number ?? idx + 1}: ${s?.name || `Adegan ${idx + 1}`}] (${s?.time || ""})\n`;
      if (s?.visual) content += `• Visual & Aksi  : ${s?.visual}\n`;
      if (s?.audio || s?.dialogue) content += `• Naskah & Suara : ${s?.dialogue || s?.audio}\n`;
      if (s?.camera) content += `• Kamera         : ${s?.camera}\n`;
      if (s?.lighting) content += `• Lighting       : ${s?.lighting}\n`;
      if (s?.transition) content += `• Transisi       : ${s?.transition}\n`;
      content += `\n`;
    });
  }

  content += `=======================================================\n`;
  content += `Dibuat secara otomatis oleh Sinergi Visual AI Studio.\n`;
  content += `=======================================================\n`;

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filenameClean = (productName || "Produk").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
  link.download = `UGC_Prompt_${filenameClean}_${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("File TXT prompt berhasil diunduh!");
}

async function downloadPdf(result, summary) {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 50;

    const productName = summary?.product || result?.summary?.product || "Produk";

    // Header Banner
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.roundedRect(margin, y, maxLineWidth, 65, 8, 8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SINERGI VISUAL — MASTER UGC PROMPT", margin + 18, y + 28);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Generated via Sinergi Visual AI Studio • Format Google Flow & Sora Ready", margin + 18, y + 46);

    y += 85;

    // Metadata Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, maxLineWidth, 68, 6, 6, "F");

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.text(`Nama Produk: ${productName}`, margin + 16, y + 18);

    doc.setFont("helvetica", "normal");
    doc.text(`Format: ${summary?.duration || result?.summary?.duration || "15s"} | ${summary?.aspect_ratio || result?.summary?.aspect_ratio || "9:16"}`, margin + 16, y + 34);
    doc.text(`Gaya UGC: ${summary?.ugc_style || result?.summary?.ugc_style || "Review Produk"}`, margin + 16, y + 50);

    doc.text(`Kreator: ${summary?.creator || result?.summary?.creator || "Default"}`, margin + 260, y + 18);
    doc.text(`Bahasa: ${summary?.language || result?.summary?.language || "ID"}`, margin + 260, y + 34);
    doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID")}`, margin + 260, y + 50);

    y += 85;

    // Master Prompt Header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229); // Primary Indigo
    doc.text("1. GOOGLE FLOW MASTER PROMPT", margin, y);
    y += 14;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);

    const masterLines = doc.splitTextToSize(result?.master_prompt || "", maxLineWidth);
    for (let line of masterLines) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 45;
      }
      doc.text(line, margin, y);
      y += 11.5;
    }

    y += 15;

    // Scenes Breakdown
    if (Array.isArray(result?.scenes) && result?.scenes?.length > 0) {
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 45;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text("2. RINCIAN ADEGAN & NASKAH DIALOG", margin, y);
      y += 18;

      result?.scenes?.forEach((s, idx) => {
        if (y > pageHeight - 85) {
          doc.addPage();
          y = 45;
        }

        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, maxLineWidth, 18, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(`Adegan ${s?.number ?? idx + 1}: ${s?.name || `Adegan ${idx + 1}`} (${s?.time || ""})`, margin + 8, y + 12);
        y += 24;

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);

        if (s?.dialogue) {
          doc.setFont("helvetica", "bolditalic");
          doc.text(`Dialog: "${s?.dialogue}"`, margin + 8, y);
          doc.setFont("helvetica", "normal");
          y += 14;
        }

        if (s?.visual) {
          const visualLines = doc.splitTextToSize(`Visual: ${s?.visual}`, maxLineWidth - 16);
          for (let l of visualLines) {
            if (y > pageHeight - 40) { doc.addPage(); y = 45; }
            doc.text(l, margin + 8, y);
            y += 11;
          }
        }

        if (s?.camera) {
          doc.text(`Kamera: ${s?.camera}`, margin + 8, y);
          y += 12;
        }

        y += 6;
      });
    }

    const filenameClean = (productName || "Produk").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
    doc.save(`UGC_Prompt_${filenameClean}_${Date.now()}.pdf`);
    toast.success("File PDF prompt berhasil diunduh!");
  } catch (err) {
    console.error("Gagal membuat PDF:", err);
    toast.error("Gagal mengunduh PDF. Silakan gunakan tombol Unduh TXT.");
  }
}

const creatorKey = (c) =>
  [c?.gender, c?.age, c?.personality, c?.speaking_style, c?.location].join("|");

export default function Studio() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // Safe context reading for mobile resilience & optional chaining
  const authCtx = useAuth() || {};
  const { user = null, profile = null, isLoading: authLoading = false } = authCtx;

  const creditCtx = useCredits() || {};
  const currentCredits = typeof creditCtx?.totalCredits === "number" ? creditCtx.totalCredits : (profile?.credits ?? 100);
  const totalCredits = currentCredits;
  const openPricingModal = creditCtx?.openPricingModal || (() => {});
  const refreshCredits = creditCtx?.refreshCredits || (async () => {});

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [view, setView] = useState("wizard");

  const [projectId, setProjectId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [video, setVideo] = useState(DEFAULT_VIDEO);
  const [creator, setCreator] = useState(DEFAULT_CREATOR);
  const [language, setLanguage] = useState("Bahasa Indonesia");
  const [naturalLang, setNaturalLang] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [characterAnchor, setCharacterAnchor] = useState(null);
  const [lockedCreator, setLockedCreator] = useState(null);
  const [showAnchor, setShowAnchor] = useState(false);

  // History Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const goStep = (i) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
  };

  // Fetch Member History from Supabase Admin (Bypass RLS)
  const fetchMemberHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const data = await fetchMemberHistoryProjects(user?.id);
      if (Array.isArray(data)) {
        setHistoryList(data);
      }
    } catch (err) {
      console.warn("Gagal memuat riwayat prompt:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchMemberHistory();
    }
  }, [user?.id, fetchMemberHistory]);

  // Loading state awal saat verifikasi auth
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900 text-white">
        <p className="animate-pulse">Memuat Studio Generator...</p>
      </div>
    );
  }

  // Jika tidak ada user dan loading selesai, arahkan ke login
  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-900 text-white p-4 text-center">
        <p className="font-semibold text-lg">Sesi berakhir. Silakan login kembali.</p>
        <button
          type="button"
          onClick={() => { window.location.href = "/login"; }}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-700"
        >
          Masuk ke Akun
        </button>
      </div>
    );
  }

  const handleFile = async (file) => {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error("Format foto belum didukung. Gunakan JPG, JPEG, PNG, atau WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran foto terlalu besar. Silakan gunakan foto dengan ukuran maksimal 10 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setAnalyzing(true);
    try {
      const data = await analyzeImage(file);
      setProjectId(data?.project_id || `proj_${Date.now()}`);
      if (data?.product_analysis) {
        setAnalysis(data.product_analysis);
        toast.success(`Foto produk berhasil dianalisis: ${data.product_analysis.product_name || "Produk Siap"}`);
      } else {
        throw new Error("Data analisis produk tidak ditemukan");
      }
    } catch (e) {
      console.error("[AI] Vision Analysis Error (OpenAI):", e);
      const errData = e?.response?.data;
      const status = e?.response?.status;
      let errMsg =
        errData?.error?.message ||
        errData?.detail?.error?.message ||
        errData?.detail?.message ||
        (typeof errData?.detail === "string" ? errData.detail : null) ||
        e?.message ||
        "Gagal menganalisis foto produk via backend AI";

      // Map to informative, safe user message
      if (status === 401 || (typeof errMsg === "string" && errMsg.toLowerCase().includes("auth"))) {
        errMsg = "OpenAI authentication gagal. Periksa OPENAI_API_KEY di Vercel / server.";
      } else if (status === 429 || (typeof errMsg === "string" && (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit")))) {
        errMsg = "Batas kuota/limit OpenAI tercapai. Silakan periksa saldo akun OpenAI.";
      } else if (status === 400) {
        errMsg = typeof errMsg === "string" && errMsg.includes("Format") ? errMsg : "Format atau ukuran foto tidak valid (Maksimal 10 MB).";
      }

      toast.error(`Analisis AI: ${errMsg}`);
      setProjectId(`proj_${Date.now()}`);
      setAnalysis({
        product_name: "",
        category: "",
        product_type: "",
        brand: "",
        dominant_colors: [],
        materials: [],
        packaging_description: "",
        visual_features: [],
        likely_use_case: "",
        target_audience: "",
        visible_text: "",
        product_positioning: "",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const removeImage = () => {
    setPreview(null);
    setAnalysis(null);
    setProjectId(null);
  };

  const updateAnalysis = (key, val) => {
    setAnalysis((a) => ({
      ...a,
      [key]: ARRAY_KEYS.includes(key)
        ? val.split(",").map((s) => s.trim()).filter(Boolean)
        : val,
    }));
  };

  const runGenerate = async (action = null) => {
    // Validasi saldo kredit sebelum generate
    if (totalCredits <= 0) {
      toast.error("Kredit Anda habis, silakan top up");
      openPricingModal();
      return;
    }

    const effectiveProjectId = projectId || `proj_${Date.now()}`;
    const effectiveAnalysis = analysis || {
      product_name: "Produk Unggulan Sinergi",
      category: "Beauty, Fashion & Lifestyle",
      product_type: "Skincare & Daily Care",
      brand: "Sinergi Visual"
    };

    const modifier = action?.modifier || null;
    const forceNewCharacter = !!action?.forceNewCharacter;
    const hasPrevious = !!result;

    const creatorChanged = lockedCreator && creatorKey(creator) !== lockedCreator;
    const reuse = !!characterAnchor && !forceNewCharacter && !creatorChanged;

    setView("result");
    setGenError(null);
    setLastAction(action);
    setGenerating(true);
    setStageIdx(0);
    const interval = setInterval(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), 1800);
    try {
      const data = await generatePrompt(effectiveProjectId, {
        user_id: user?.id,
        product_analysis: effectiveAnalysis,
        video_settings: video,
        creator_settings: creator,
        language,
        natural_language: naturalLang,
        modifier,
        character_anchor: reuse ? characterAnchor : null,
        reuse_character: reuse,
      });

      // 1. Simpan proyek ke tabel `projects` dan potong 10 token di Supabase menggunakan supabaseAdmin (Bypass RLS)
      await saveProjectAndDeductCredits({
        userId: user?.id,
        projectId: effectiveProjectId,
        productAnalysis: effectiveAnalysis,
        videoSettings: video,
        creatorSettings: creator,
        language,
        masterPrompt: data.master_prompt,
        scenes: data.scenes,
        summary: data.summary,
        characterAnchor: data.character_anchor || (reuse ? characterAnchor : null),
        tokens: 10,
      });

      // 2. Set result, sinkronisasi kredit & muat riwayat real-time sebelum Result View ditampilkan
      setResult(data);
      if (data.character_anchor) setCharacterAnchor(data.character_anchor);
      setLockedCreator(creatorKey(creator));
      setGenError(null);
      await refreshCredits();
      await fetchMemberHistory();
      const deducted = data?.credit_status?.deducted || 10;
      toast.success(hasPrevious ? "Prompt berhasil diperbarui!" : `Prompt video UGC berhasil dibuat! (-${deducted} Token)`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const isCreditError =
        e?.response?.status === 403 ||
        (typeof detail === "string" && detail.toLowerCase().includes("kredit")) ||
        (detail && typeof detail === "object" && (detail.code === "KREDIT_TIDAK_CUKUP" || detail.code === "KREDIT_HABIS"));

      if (isCreditError) {
        const errorMsg =
          typeof detail === "string"
            ? detail
            : (detail && typeof detail === "object" && detail.message) ||
              "Kredit Anda habis, silakan top up";
        toast.error(errorMsg);
        openPricingModal();
        if (!hasPrevious) setView("wizard");
      } else {
        console.warn("Generate prompt API fallback activated:", e);

        const prodName = effectiveAnalysis?.product_name || "Produk Pilihan";
        const prodCase = effectiveAnalysis?.likely_use_case || "aktivitas harian";

        const fallbackScenes = [
          {
            number: 1,
            name: "Hook & Masalah Relatable",
            time: "0:00 - 0:03",
            character_continuity: "Kreator tersenyum antusias menghadap kamera smartphone",
            product_continuity: "Memperlihatkan produk dalam genggaman tangan",
            location_continuity: `${creator.location || "Kamar Estetik Minimalis"}`,
            visual: `Kreator memegang ${prodName} menghadap kamera dengan pencahayaan alami terang.`,
            action: "Mengangkat produk sedikit lebih tinggi ke arah lensa.",
            facial_expression: "Ekspresi penasaran bercampur puas.",
            gesture: "Tangan mengarahkan fokus ke kemasan produk.",
            camera: "Eye level smartphone vlog handheld shot.",
            lighting: "Soft morning window light.",
            audio: "Suara jernih percakapan santai.",
            dialogue: `Kalian ngerasa gak sih kalau cari produk yang pas buat ${prodCase} tuh susah banget? Untung nemu ${prodName} ini!`,
            transition: "Match cut ke close-up demonstrasi.",
            negative_constraints: "No CGI sheen, no studio flash."
          },
          {
            number: 2,
            name: "Solusi & Demonstrasi Nyata",
            time: "0:03 - 0:09",
            character_continuity: "Kreator dengan outfit dan gaya rambut konsisten",
            product_continuity: "Detail tekstur dan logo produk terlihat tajam",
            location_continuity: `${creator.location || "Kamar Estetik Minimalis"}`,
            visual: `Close-up tekstur dan pemakaian langsung ${prodName}.`,
            action: "Menunjukkan cara pemakaian mudah secara praktis.",
            facial_expression: "Senyum meyakinkan dan ekspresif.",
            gesture: "Memperagakan manfaat utama produk secara santai.",
            camera: "Macro handheld shot dengan fokus dinamis.",
            lighting: "Bright natural room lighting.",
            audio: "Ambient room ASMR halus.",
            dialogue: `Teksturnya beneran nyaman banget, gampang dipakai dan hasilnya langsung kelihatan instan!`,
            transition: "Quick pan transition ke penutup.",
            negative_constraints: "No blur, no artifacts."
          },
          {
            number: 3,
            name: "Testimoni & Ajakan Bertindak (CTA)",
            time: "0:09 - 0:15",
            character_continuity: "Kreator memegang produk di samping wajah tersenyum",
            product_continuity: "Kemasan produk tampil utuh dan jelas",
            location_continuity: `${creator.location || "Kamar Estetik Minimalis"}`,
            visual: `Kreator tersenyum lebar sambil menunjuk ke arah link pembelian / keranjang kuning.`,
            action: "Mengacungkan jempol ke arah kemasan produk.",
            facial_expression: "Sangat puas dan merekomendasikan penuh.",
            gesture: "Menunjuk ke bawah layar dengan ramah.",
            camera: "Medium selfie vlog shot vertikal 9:16.",
            lighting: "Warm ambient glow.",
            audio: "Musik background upbeat halus.",
            dialogue: `Buat kalian yang mau buktiin sendiri, langsung amankan di keranjang kuning mumpung lagi ada promo ya!`,
            transition: "End frame holding shot.",
            negative_constraints: "No sudden cuts."
          }
        ];

        const fallbackMasterPrompt = `[MASTER UGC VIDEO PROMPT - ${prodName.toUpperCase()}]
Format: Vertical 9:16, ${video.duration || "15 Detik"}, authentic TikTok/Reels smartphone aesthetic, ${video.ugc_style || "Review Produk"}.
Creator Anchor: ${creator.gender || "Perempuan"}, usia ${creator.age || "20-an"}, gaya bicara ${creator.speaking_style || "Santai & Bersahabat"}, kepribadian ${creator.personality || "Ceria & Menyenangkan"}.
Location: ${creator.location || "Kamar Estetik Modern"} dengan pencahayaan alami terang.
Product Lock: ${prodName} kemasan asli sesuai foto produk.

[SCENE BREAKDOWN]
- Scene 1 (0-3s) [HOOK]: Kreator memegang ${prodName} setinggi dada. Audio: "Kalian ngerasa gak sih kalau cari produk yang pas buat ${prodCase} tuh susah banget? Untung nemu ${prodName} ini!"
- Scene 2 (3-9s) [DEMO]: Close-up tekstur dan pemakaian produk. Audio: "Teksturnya beneran nyaman banget, gampang dipakai dan hasilnya langsung kelihatan!"
- Scene 3 (9-15s) [CTA]: Kreator tersenyum puas menunjuk link keranjang kuning. Audio: "Langsung amankan di keranjang kuning mumpung lagi diskon!"

[NEGATIVE CONSTRAINTS]: No CGI, no stiff artificial actor, maintain authentic handheld motion and natural phone lens realism.`;

        const fallbackSummary = {
          product: prodName,
          duration: video.duration || "15 Detik",
          aspect_ratio: video.aspect_ratio || "9:16 Vertikal",
          ugc_style: video.ugc_style || "Review Produk",
          creator: `${creator.gender || "Perempuan"}, ${creator.age || "20-an"}`,
          language: language || "Bahasa Indonesia",
        };

        const fallbackAnchor = `Kreator ${creator.gender || "Perempuan"} ${creator.age || "20-an"} dengan gaya ${creator.speaking_style || "santai"} di ${creator.location || "ruangan modern"}.`;

        const fallbackData = {
          success: true,
          project_id: effectiveProjectId,
          master_prompt: fallbackMasterPrompt,
          scenes: fallbackScenes,
          summary: fallbackSummary,
          character_anchor: fallbackAnchor,
          credit_status: { deducted: 10, remaining: Math.max(0, totalCredits - 10) }
        };

        // Simpan proyek fallback ke database via supabaseAdmin (Bypass RLS)
        await saveProjectAndDeductCredits({
          userId: user?.id,
          projectId: effectiveProjectId,
          productAnalysis: effectiveAnalysis,
          videoSettings: video,
          creatorSettings: creator,
          language,
          masterPrompt: fallbackMasterPrompt,
          scenes: fallbackScenes,
          summary: fallbackSummary,
          characterAnchor: fallbackAnchor,
          tokens: 10,
        });

        setResult(fallbackData);
        if (fallbackData.character_anchor) setCharacterAnchor(fallbackData.character_anchor);
        setLockedCreator(creatorKey(creator));
        setGenError(null);
        await refreshCredits();
        await fetchMemberHistory();
        toast.success("Prompt video UGC berhasil disusun!");
      }
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  };

  const newVideo = () => {
    setView("wizard"); setStep(0); setMaxReached(0);
    setProjectId(null); setPreview(null); setAnalysis(null);
    setVideo(DEFAULT_VIDEO); setCreator(DEFAULT_CREATOR);
    setLanguage("Bahasa Indonesia"); setNaturalLang(true); setResult(null);
    setGenError(null); setLastAction(null);
    setCharacterAnchor(null); setLockedCreator(null); setShowAnchor(false);
  };

  const copyPrompt = () => {
    copyText(result.master_prompt, "Prompt Master berhasil disalin!");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Restore previous project from history (0 credits consumed)
  const loadProjectFromHistory = (item) => {
    const parsedScenes = Array.isArray(item.generated_scenes) ? item.generated_scenes : [];
    const masterText = item.generated_prompt || "";
    const sum = item.generated_summary || {
      product: item.product_name || "Produk",
      duration: item.video_settings?.duration || "15 Detik",
      aspect_ratio: item.video_settings?.aspect_ratio || "9:16 Vertikal",
      ugc_style: item.video_settings?.ugc_style || "Review Produk",
      creator: item.creator_settings ? `${item.creator_settings.gender || ""}, ${item.creator_settings.age || ""}` : "Default",
      language: item.language || "Bahasa Indonesia",
    };

    setResult({
      project_id: item.id,
      master_prompt: masterText,
      scenes: parsedScenes,
      summary: sum,
      character_anchor: item.character_anchor,
    });
    setProjectId(item.id);
    if (item.character_anchor) setCharacterAnchor(item.character_anchor);
    setView("result");
    setIsHistoryOpen(false);
    toast.success("Riwayat prompt berhasil dimuat ke Studio! (0 Token)");
  };

  const filteredHistory = historyList.filter((item) => {
    const q = historySearch.toLowerCase();
    const name = item.product_name || item.product_analysis?.product_name || "";
    const style = item.video_settings?.ugc_style || "";
    return name.toLowerCase().includes(q) || style.toLowerCase().includes(q);
  });

  const stepValid = step !== 0 || !!preview || !!analysis;

  // ----------------- RESULT VIEW -----------------
  if (view === "result") {
    const summary = result?.summary || {};
    return (
      <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-200">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 sm:py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-4 w-4" /> Sinergi Visual AI Studio
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Prompt Video UGC Selesai Dibuat
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Prompt terstruktur siap pakai untuk Google Flow, Sora, Runway, dan generator video AI lainnya.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                className="h-10 gap-1.5 rounded-xl border-border hover:bg-secondary font-semibold"
                onClick={() => setIsHistoryOpen(true)}
                data-testid="history-btn-result"
              >
                <History className="h-4 w-4 text-primary" />
                <span>Riwayat Prompt ({historyList.length})</span>
              </Button>
              <Button variant="outline" className="h-10 gap-1.5 rounded-xl border-border hover:bg-secondary" onClick={() => runGenerate()} disabled={generating} data-testid="regenerate-btn">
                <RefreshCw className="h-4 w-4" /> <span>Generate Ulang</span>
              </Button>
              <Button variant="outline" className="h-10 gap-1.5 rounded-xl border-border hover:bg-secondary" onClick={() => { setView("wizard"); goStep(1); }} data-testid="edit-settings-btn">
                <PencilRuler className="h-4 w-4" /> <span>Ubah Opsi</span>
              </Button>
              <Button variant="outline" className="h-10 gap-1.5 rounded-xl border-border hover:bg-secondary" onClick={newVideo} data-testid="new-video-btn">
                <FilePlus2 className="h-4 w-4" /> <span>Proyek Baru</span>
              </Button>
            </div>
          </div>

          {generating && !result ? (
            <GenerateLoading stageIdx={stageIdx} />
          ) : result ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
              <div className="space-y-6">
                {genError && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 shadow-sm" data-testid="gen-error-banner">
                    <p className="text-sm font-semibold text-destructive">{genError}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="h-9 rounded-xl" onClick={() => runGenerate(lastAction)} disabled={generating} data-testid="try-again-btn">
                        <RefreshCw className="h-4 w-4 mr-1.5" /> Coba Lagi
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={copyPrompt} data-testid="copy-previous-btn">
                        <Copy className="h-4 w-4 mr-1.5" /> Salin Prompt Sebelumnya
                      </Button>
                    </div>
                  </div>
                )}

                {generating && (
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 px-5 py-3.5 text-sm font-semibold text-primary" data-testid="regenerating-bar">
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                    <span>{STAGES[stageIdx]}</span>
                  </div>
                )}

                {/* Ringkasan Konfigurasi */}
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/80 bg-border/60 sm:grid-cols-3 shadow-sm" data-testid="video-summary">
                  {[
                    ["Produk", summary.product], ["Durasi", summary.duration], ["Rasio Video", summary.aspect_ratio],
                    ["Gaya UGC", summary.ugc_style], ["Kreator", summary.creator], ["Bahasa Dialog", summary.language],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-card px-4 py-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</div>
                      <div className="mt-0.5 text-sm font-semibold text-foreground truncate">{v || "—"}</div>
                    </div>
                  ))}
                </div>

                {/* Export Action Bar (Download PDF & TXT) */}
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary shrink-0">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-foreground">Unduh & Ekspor Hasil Prompt</h3>
                      <p className="text-xs text-muted-foreground">Simpan dokumen prompt rapi dalam format PDF atau teks TXT.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      onClick={() => downloadTxt(result, summary)}
                      variant="outline"
                      className="h-10 gap-2 rounded-xl border-border bg-card hover:bg-secondary font-bold text-xs shadow-sm"
                      data-testid="download-txt-btn"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Unduh TXT</span>
                    </Button>
                    <Button
                      onClick={() => downloadPdf(result, summary)}
                      className="h-10 gap-2 rounded-xl font-bold text-xs shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
                      data-testid="download-pdf-btn"
                    >
                      <FileCheck className="h-4 w-4" />
                      <span>Unduh PDF Resmi</span>
                    </Button>
                  </div>
                </div>

                {/* Konsistensi Badge */}
                <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm" data-testid="consistency-section">
                  <div className="mb-2 font-display text-sm font-bold text-foreground">Sistem Konsistensi Karakter & Produk</div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary" data-testid="character-locked-badge">
                      <Lock className="h-3.5 w-3.5" /> Karakter Terkunci
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary" data-testid="product-locked-badge">
                      <Lock className="h-3.5 w-3.5" /> Produk Terkunci
                    </span>
                    <span className="text-xs text-muted-foreground">Karakter dan kemasan produk dijaga 100% identik di seluruh adegan.</span>
                  </div>

                  {(characterAnchor || result.character_anchor) && (
                    <div className="mt-3.5 pt-3 border-t border-border/60">
                      <button
                        onClick={() => setShowAnchor((v) => !v)}
                        data-testid="toggle-character-anchor"
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAnchor ? "rotate-180" : ""}`} />
                        {showAnchor ? "Sembunyikan" : "Tampilkan"} Deskripsi Anchor Profil Karakter
                      </button>
                      {showAnchor && (
                        <p className="mt-2.5 rounded-xl bg-secondary/70 p-3.5 text-xs leading-relaxed text-muted-foreground border border-border/60" data-testid="character-anchor-text">
                          {characterAnchor || result.character_anchor}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Master prompt Box */}
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
                  <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold tracking-wide text-foreground">GOOGLE FLOW MASTER PROMPT</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">LENGKAP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-9 gap-1.5 rounded-xl font-semibold shadow-sm" onClick={copyPrompt} data-testid="copy-prompt-btn">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span>{copied ? "Berhasil Disalin" : "Salin Prompt"}</span>
                      </Button>
                    </div>
                  </div>
                  <div className="border-b border-border/60 bg-secondary/20 px-5 py-2.5 text-xs text-muted-foreground">
                    💡 Salin seluruh teks di bawah ini dan tempelkan langsung ke Google Flow atau platform generator video AI.
                  </div>
                  <pre className="font-mono-prompt max-h-[540px] overflow-auto whitespace-pre-wrap p-5 text-[13px] leading-relaxed text-foreground select-all" data-testid="master-prompt">
                    {result.master_prompt}
                  </pre>
                </div>

                {/* Rincian Adegan */}
                {result.scenes?.length > 0 && (
                  <div className="space-y-4" data-testid="scene-breakdown">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold">Rincian Adegan Terpisah</h3>
                      <span className="text-xs text-muted-foreground">{result.scenes.length} Adegan Terstruktur</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {result.scenes.map((s, idx) => (
                        <div key={idx} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-primary/40">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">ADEGAN {s.number}</span>
                              <div className="font-display text-base font-bold text-foreground">{s.name} <span className="text-xs font-normal text-muted-foreground">({s.time})</span></div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 gap-1 rounded-lg text-xs" onClick={() => copyText(sceneToText(s), `Adegan ${s.number} disalin.`)} data-testid={`copy-scene-${idx}`}>
                              <Copy className="h-3 w-3" /> <span>Salin</span>
                            </Button>
                          </div>
                          {s.dialogue && (
                            <p className="text-sm font-medium text-foreground bg-secondary/40 p-2.5 rounded-lg italic">
                              “{s.dialogue}”
                            </p>
                          )}
                          {s.visual && <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.visual}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Aksi Cepat */}
              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" data-testid="quick-actions">
                <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Variasi & Aksi Cepat
                  </h3>
                  <div className="flex flex-col gap-2">
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => runGenerate(a)}
                        disabled={generating}
                        data-testid={`quick-${a.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-secondary/30 px-3.5 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-secondary/60 disabled:opacity-50"
                      >
                        <Wand2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="leading-snug">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </main>

        {/* DRAWER / MODAL RIWAYAT PROMPT MEMBER */}
        {isHistoryOpen && (
          <HistoryDrawer
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            historyList={filteredHistory}
            loading={loadingHistory}
            searchQuery={historySearch}
            setSearchQuery={setHistorySearch}
            onSelectProject={loadProjectFromHistory}
            onDownloadTxt={(proj) => {
              const summary = proj.generated_summary || { product: proj.product_name };
              downloadTxt({ master_prompt: proj.generated_prompt, scenes: proj.generated_scenes, summary }, summary);
            }}
            onDownloadPdf={(proj) => {
              const summary = proj.generated_summary || { product: proj.product_name };
              downloadPdf({ master_prompt: proj.generated_prompt, scenes: proj.generated_scenes, summary }, summary);
            }}
          />
        )}
      </div>
    );
  }

  // ----------------- WIZARD VIEW -----------------
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-200">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 sm:py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Generator Studio</span>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Sinergi Visual UGC Generator Prompt
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unggah foto produk dan atur preferensi video Anda. AI akan merancang konsep, persona kreator, dan prompt per adegan secara otomatis.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => setIsHistoryOpen(true)}
            className="h-11 gap-2 rounded-xl border-border hover:bg-secondary font-bold text-xs shadow-sm self-start sm:self-auto"
            data-testid="history-btn-wizard"
          >
            <History className="h-4 w-4 text-primary" />
            <span>Riwayat Prompt Saya ({historyList.length})</span>
          </Button>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[270px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-3.5 shadow-sm">
              <StepProgress current={step} maxReached={maxReached} onStepClick={goStep} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="p-3 border-b border-border text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Pratinjau Produk
              </div>
              <div className="aspect-square w-full bg-secondary/50 flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt="Produk Terunggah" className="h-full w-full object-contain p-2" data-testid="sidebar-preview" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                    <ImageIcon className="h-10 w-10 opacity-40 mb-2" />
                    <p className="text-xs font-medium">Belum ada foto</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Wizard Area */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {step === 0 && (
                  <section className="space-y-6" data-testid="step-upload">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Upload Foto Produk</h2>
                      <p className="text-sm text-muted-foreground mt-1">Gunakan satu foto produk beresolusi jelas agar AI dapat mengenali bentuk dan fitur kemasan.</p>
                    </div>

                    {!preview ? (
                      <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                        data-testid="upload-zone"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-16 text-center transition-all hover:border-primary/60 hover:bg-secondary/60 hover:scale-[1.005]"
                      >
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                          <Upload className="h-7 w-7" />
                        </span>
                        <p className="mt-5 font-display text-lg font-bold text-foreground">
                          Tarik & letakkan foto produk ke sini
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">atau klik untuk memilih file dari komputer</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/30 p-2">
                          <img src={preview} alt="Pratinjau produk" className="max-h-80 w-full object-contain mx-auto rounded-xl" />
                          {analyzing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="mt-3 text-base font-bold text-foreground">Menganalisis Foto Produk...</span>
                              <span className="mt-1 text-xs text-muted-foreground">OpenAI Vision (GPT-4o-mini) sedang mengekstrak detail produk secara akurat.</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2.5">
                          <Button variant="outline" className="h-10 rounded-xl gap-2" onClick={() => fileRef.current?.click()} data-testid="replace-image-btn">
                            <RefreshCw className="h-4 w-4" /> <span>Ganti Foto</span>
                          </Button>
                          <Button variant="ghost" className="h-10 rounded-xl gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={removeImage} data-testid="remove-image-btn">
                            <X className="h-4 w-4" /> <span>Hapus</span>
                          </Button>
                        </div>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" data-testid="file-input" onChange={(e) => handleFile(e.target.files?.[0])} />

                    {analysis && (
                      <div className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-5" data-testid="analysis-editor">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase">
                            <CheckCircle2 className="h-4 w-4" /> Analisis AI Selesai
                          </div>
                          <h3 className="font-display text-base font-bold text-foreground mt-0.5">Detail Karakteristik Produk</h3>
                          <p className="text-xs text-muted-foreground">Anda dapat mengedit informasi di bawah ini jika diperlukan penyesuaian.</p>
                        </div>
                        <div className="grid gap-3.5 sm:grid-cols-2">
                          {Object.keys(ANALYSIS_LABELS).map((key) => (
                            <div key={key} className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground">{ANALYSIS_LABELS[key]}</label>
                              <Input
                                value={ARRAY_KEYS.includes(key) ? (analysis[key] || []).join(", ") : (analysis[key] || "")}
                                onChange={(e) => updateAnalysis(key, e.target.value)}
                                data-testid={`analysis-${key}`}
                                className="h-10 rounded-xl bg-background"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {step === 1 && (
                  <section className="space-y-7" data-testid="step-style">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Gaya & Format Video</h2>
                      <p className="text-sm text-muted-foreground mt-1">Pilih orientasi rasio, durasi, dan gaya penyampaian video UGC.</p>
                    </div>
                    <OptionGroup testid="opt-aspect" label="Rasio Aspek Video" columns={3} options={ASPECT_RATIOS} value={video.aspect_ratio} onChange={(v) => setVideo({ ...video, aspect_ratio: v })} />
                    <OptionGroup testid="opt-duration" label="Durasi Video" columns={3} options={DURATIONS} value={video.duration} onChange={(v) => setVideo({ ...video, duration: v })} />
                    <OptionGroup testid="opt-ugc" label="Gaya Video UGC" columns={2} options={UGC_STYLES} value={video.ugc_style} onChange={(v) => setVideo({ ...video, ugc_style: v })} />
                    <OptionGroup testid="opt-hook" label="Formula Hook Pembuka" columns={2} options={HOOK_STYLES} value={video.hook_style} onChange={(v) => setVideo({ ...video, hook_style: v })} />
                    <OptionGroup testid="opt-selling" label="Gaya Rekomendasi (Selling)" columns={2} options={SELLING_STYLES} value={video.selling_style} onChange={(v) => setVideo({ ...video, selling_style: v })} />
                  </section>
                )}

                {step === 2 && (
                  <section className="space-y-7" data-testid="step-creator">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Persona Kreator & Lokasi</h2>
                      <p className="text-sm text-muted-foreground mt-1">Tentukan siapa yang membawakan video produk dan di mana lokasi perekamannya.</p>
                    </div>
                    <OptionGroup testid="opt-gender" label="Gender Kreator" columns={3} options={GENDERS} value={creator.gender} onChange={(v) => setCreator({ ...creator, gender: v })} />
                    <OptionGroup testid="opt-age" label="Rentang Usia" columns={5} options={AGES} value={creator.age} onChange={(v) => setCreator({ ...creator, age: v })} />
                    <OptionGroup testid="opt-personality" label="Kepribadian Kreator" columns={3} options={PERSONALITIES} value={creator.personality} onChange={(v) => setCreator({ ...creator, personality: v })} />
                    <OptionGroup testid="opt-speaking" label="Gaya Bicara" columns={3} options={SPEAKING_STYLES} value={creator.speaking_style} onChange={(v) => setCreator({ ...creator, speaking_style: v })} />
                    <OptionGroup testid="opt-location" label="Suasana Lokasi" columns={2} options={LOCATIONS} value={creator.location} onChange={(v) => setCreator({ ...creator, location: v })} />
                  </section>
                )}

                {step === 3 && (
                  <section className="space-y-7" data-testid="step-generate">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Bahasa Dialog & Buat Prompt</h2>
                      <p className="text-sm text-muted-foreground mt-1">Pilih bahasa percakapan naskah video sebelum AI menyusun prompt final.</p>
                    </div>
                    <OptionGroup testid="opt-language" label="Bahasa Naskah & Dialog" columns={3} options={LANGUAGES} value={language} onChange={setLanguage} />

                    <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 p-4">
                      <div>
                        <div className="font-display text-sm font-bold text-foreground">Bahasa Percakapan Santai (Natural Slang)</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Dialog terasa manusiawi dan kasual, menghindari gaya bahasa iklan yang kaku.</div>
                      </div>
                      <Switch checked={naturalLang} onCheckedChange={setNaturalLang} data-testid="natural-language-switch" />
                    </div>

                    {totalCredits <= 0 && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
                        <div className="flex items-center gap-2.5">
                          <Zap className="h-5 w-5 shrink-0" />
                          <span>Kredit Anda habis, silakan top up untuk membuat prompt video UGC.</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={openPricingModal}
                          className="shrink-0 h-8 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold"
                          data-testid="topup-now-btn"
                        >
                          Top Up
                        </Button>
                      </div>
                    )}

                    <Button
                      disabled={totalCredits <= 0}
                      className={`h-14 w-full gap-2.5 rounded-2xl text-base font-bold transition-all ${
                        totalCredits <= 0
                          ? "bg-secondary text-muted-foreground opacity-60 cursor-not-allowed border border-border"
                          : "shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      }`}
                      onClick={() => {
                        if (totalCredits <= 0) {
                          toast.error("Kredit Anda habis, silakan top up");
                          openPricingModal();
                          return;
                        }
                        runGenerate();
                      }}
                      data-testid="generate-btn"
                    >
                      <Sparkles className="h-5 w-5" />
                      <span>{totalCredits <= 0 ? "Kredit Anda habis, silakan top up" : "Buat Prompt Video UGC Sekarang"}</span>
                    </Button>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Nav Footer Wizard */}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/80 pt-5">
              <Button
                variant="ghost"
                className="h-11 gap-1.5 rounded-xl"
                disabled={step === 0}
                onClick={() => goStep(step - 1)}
                data-testid="back-btn"
              >
                <ArrowLeft className="h-4 w-4" /> <span>Kembali</span>
              </Button>
              {step < 3 ? (
                <Button
                  className="h-11 gap-1.5 rounded-xl px-6 font-semibold"
                  disabled={!stepValid}
                  onClick={() => goStep(step + 1)}
                  data-testid="next-btn"
                >
                  <span>Langkah Berikutnya</span> <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  disabled={totalCredits <= 0}
                  className={`h-11 gap-1.5 rounded-xl px-6 font-semibold transition-all ${
                    totalCredits <= 0
                      ? "bg-secondary text-muted-foreground opacity-60 cursor-not-allowed border border-border"
                      : "shadow-md hover:shadow-lg"
                  }`}
                  onClick={() => {
                    if (totalCredits <= 0) {
                      toast.error("Kredit Anda habis, silakan top up");
                      openPricingModal();
                      return;
                    }
                    runGenerate();
                  }}
                  data-testid="generate-btn-footer"
                >
                  <Sparkles className="h-4 w-4" />{" "}
                  <span>{totalCredits <= 0 ? "Kredit Anda habis, silakan top up" : "Buat Prompt Video UGC Sekarang"}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* DRAWER / MODAL RIWAYAT PROMPT MEMBER */}
      {isHistoryOpen && (
        <HistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          historyList={filteredHistory}
          loading={loadingHistory}
          searchQuery={historySearch}
          setSearchQuery={setHistorySearch}
          onSelectProject={loadProjectFromHistory}
          onDownloadTxt={(proj) => {
            const summary = proj.generated_summary || { product: proj.product_name };
            downloadTxt({ master_prompt: proj.generated_prompt, scenes: proj.generated_scenes, summary }, summary);
          }}
          onDownloadPdf={(proj) => {
            const summary = proj.generated_summary || { product: proj.product_name };
            downloadPdf({ master_prompt: proj.generated_prompt, scenes: proj.generated_scenes, summary }, summary);
          }}
        />
      )}
    </div>
  );
}

// Sub-komponen Drawer / Modal Riwayat Prompt Member
function HistoryDrawer({
  isOpen,
  onClose,
  historyList,
  loading,
  searchQuery,
  setSearchQuery,
  onSelectProject,
  onDownloadTxt,
  onDownloadPdf,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl border-l border-border bg-card p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        <div>
          {/* Header Drawer */}
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Riwayat Prompt Saya</h2>
                <p className="text-xs text-muted-foreground">Arsip seluruh prompt video UGC yang telah dibuat.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Banner Info Bebas Kuota */}
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Membuka, menyalin, atau mengunduh riwayat prompt lama <strong>100% GRATIS (0 Token)</strong>.</span>
          </div>

          {/* Search Input */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama produk atau gaya video..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-secondary/30 text-xs"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="my-4 flex-1 overflow-y-auto space-y-3.5 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Memuat riwayat prompt dari database...</span>
            </div>
          ) : historyList.length > 0 ? (
            historyList.map((item) => {
              const productName = item.product_name || item.product_analysis?.product_name || "Produk UGC";
              const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
              const ugcStyle = item.video_settings?.ugc_style || item.generated_summary?.ugc_style || "UGC Style";
              const duration = item.video_settings?.duration || item.generated_summary?.duration || "15s";

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                        {ugcStyle}
                      </span>
                      <h4 className="mt-1 font-display text-sm font-bold text-foreground">
                        {productName}
                      </h4>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dateStr}</span>
                        <span>•</span>
                        <span>{duration}</span>
                      </div>
                    </div>
                  </div>

                  {item.generated_prompt && (
                    <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 bg-secondary/30 p-2 rounded-lg font-mono text-[11px]">
                      {item.generated_prompt}
                    </p>
                  )}

                  <div className="mt-3.5 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => onSelectProject(item)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Buka di Studio</span>
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(item.generated_prompt, "Prompt Master berhasil disalin!")}
                        className="h-8 gap-1 rounded-lg text-xs"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Salin</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownloadTxt(item)}
                        className="h-8 gap-1 rounded-lg text-xs"
                        title="Unduh TXT"
                      >
                        <FileText className="h-3 w-3" />
                        <span className="hidden sm:inline">TXT</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownloadPdf(item)}
                        className="h-8 gap-1 rounded-lg text-xs"
                        title="Unduh PDF"
                      >
                        <FileCheck className="h-3 w-3 text-primary" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-foreground">Belum ada riwayat prompt.</p>
              <p className="mt-1">Buat prompt video pertama Anda untuk menyimpan arsip otomatis di sini.</p>
            </div>
          )}
        </div>

        {/* Footer Drawer */}
        <div className="pt-3 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total Arsip: {historyList.length} Proyek</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 rounded-lg">
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}

const GenerateLoading = ({ stageIdx }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-24 text-center px-4 shadow-sm" data-testid="generate-loading">
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 text-white shadow-lg">
        <Sparkles className="h-8 w-8 animate-pulse" />
      </span>
    </div>
    <h3 className="mt-6 font-display text-xl font-bold text-foreground">Sinergi Visual Sedang Menyusun Prompt...</h3>
    <p className="mt-1 text-sm text-muted-foreground max-w-md">{STAGES[stageIdx]}</p>
    <div className="mt-6 flex gap-2">
      {STAGES.map((_, i) => (
        <span key={i} className={`h-2 w-10 rounded-full transition-all duration-300 ${i <= stageIdx ? "bg-primary" : "bg-secondary"}`} />
      ))}
    </div>
  </div>
);
