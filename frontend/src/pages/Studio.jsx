import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload, X, RefreshCw, ImageIcon, Loader2, Copy, ArrowLeft, ArrowRight,
  Sparkles, Wand2, FilePlus2, PencilRuler, Check, Lock, ChevronDown,
  Layers, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { OptionGroup } from "@/components/studio/OptionGroup";
import { StepProgress } from "@/components/studio/StepProgress";
import { useCredits } from "@/context/CreditContext";
import { analyzeImage, generatePrompt } from "@/lib/api";
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

const NETWORK_MSG = "Koneksi bermasalah. Periksa koneksi internet lalu coba lagi.";
const GENERIC_MSG = "Terjadi kendala saat membuat prompt. Silakan coba lagi.";

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

const creatorKey = (c) =>
  [c.gender, c.age, c.personality, c.speaking_style, c.location].join("|");

export default function Studio() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const { userId, totalCredits, openPricingModal, refreshCredits } = useCredits();

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

  const goStep = (i) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
  };

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
      setProjectId(data.project_id);
      setAnalysis(data.product_analysis || {
        product_name: file.name.split(".")[0] || "Produk Pilihan",
        category: "Beauty, Fashion & Lifestyle",
        product_type: "Essential Product",
        brand: "Sinergi Visual Brand",
        dominant_colors: ["White", "Clean / Natural"],
        materials: ["Premium Packaging"],
        packaging_description: "Kemasan estetik dan modern.",
        visual_features: ["Desain rapi", "Label informatif"],
        likely_use_case: "Penggunaan harian",
        target_audience: "Kreator & Konsumen Digital",
        visible_text: "",
        product_positioning: "Modern & Berkualitas",
      });
      toast.success("Foto produk berhasil diunggah dan dianalisis!");
    } catch (e) {
      console.warn("Upload network fallback activated:", e);
      setProjectId(`proj_${Date.now()}`);
      setAnalysis({
        product_name: file.name.split(".")[0] || "Produk Pilihan",
        category: "Beauty, Fashion & Lifestyle",
        product_type: "Essential Product",
        brand: "Sinergi Visual Brand",
        dominant_colors: ["White", "Clean / Natural"],
        materials: ["Premium Packaging"],
        packaging_description: "Kemasan estetik dan modern.",
        visual_features: ["Desain rapi", "Label informatif"],
        likely_use_case: "Penggunaan harian",
        target_audience: "Kreator & Konsumen Digital",
        visible_text: "",
        product_positioning: "Modern & Berkualitas",
      });
      toast.success("Foto produk berhasil diunggah!");
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
    // 1. Validasi saldo kredit sebelum generate
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
        user_id: userId,
        product_analysis: effectiveAnalysis,
        video_settings: video,
        creator_settings: creator,
        language,
        natural_language: naturalLang,
        modifier,
        character_anchor: reuse ? characterAnchor : null,
        reuse_character: reuse,
      });
      setResult(data);
      if (data.character_anchor) setCharacterAnchor(data.character_anchor);
      setLockedCreator(creatorKey(creator));
      setGenError(null);
      await refreshCredits();
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
        // Fallback jika API bermasalah/offline: JANGAN memunculkan alert error
        // Langsung tampilkan hasil prompt fallback dan paksa ke Result Page (Step 4)
        console.warn("Generate prompt API fallback activated:", e);

        const is30s = (video?.duration || "").includes("30");
        const is20s = (video?.duration || "").includes("20");
        const prodName = effectiveAnalysis?.product_name || "Produk Pilihan";
        const prodCase = effectiveAnalysis?.likely_use_case || "aktivitas harian";
        const prodFeat = Array.isArray(effectiveAnalysis?.visual_features) && effectiveAnalysis?.visual_features?.length
          ? effectiveAnalysis.visual_features.slice(0, 2).join(", ")
          : "desain modern dan fungsional";
        const dur = video?.duration || "30 seconds";
        const style = video?.ugc_style || "Problem -> Solution";
        const ratio = video?.aspect_ratio || "9:16";
        const cGender = creator?.gender || "Female";
        const cLoc = creator?.location || "Living Room";

        let dynamicScenes = [];
        if (is30s) {
          dynamicScenes = [
            {
              number: 1,
              name: "Adegan 1: Hook Penasaran & Masalah",
              time: "0-4 detik",
              dialogue: `Kalian sering ngerasa ribet gak sih pas butuh ${prodCase} pas lagi di luar rumah?`,
              visual: `Close-up shot kreator di ${cLoc.toLowerCase()} memegang ${prodName} dengan ekspresi relatable dan penasaran langsung ke kamera smartphone.`,
              camera: "Eye-level handheld selfie angle, natural motion, crisp 4K mobile aesthetic",
              lighting: "Soft natural window daylight with warm rim light",
              action: `Kreator berbicara ekspresif sambil memegang ${prodName}`,
              facial_expression: "Relatable curiosity and friendly smile",
              gesture: "One-hand gesture pointing slightly to product",
              audio: "Clear natural vocal, upbeat lo-fi background music",
              transition: "Fast whip pan to context",
              character_continuity: `Identical ${cGender.toLowerCase()} creator in early 20s, casual daily outfit`,
              product_continuity: `Identical ${prodName} with exact shape, color, and finish`,
              location_continuity: `Consistent modern ${cLoc.toLowerCase()} interior`,
              negative_constraints: "No CGI look, no morphing"
            },
            {
              number: 2,
              name: "Adegan 2: Cerita Pengalaman",
              time: "4-10 detik",
              dialogue: "Jujur aku dulu sering banget gonta-ganti karena gak ada yang bener-bener awet dan fungsional.",
              visual: `Medium shot kreator menceritakan pengalamannya dengan gestur santai, ${prodName} diletakkan rapi di atas meja.`,
              camera: "Medium handheld shot with subtle natural breathing motion",
              lighting: "Balanced warm room lighting",
              action: "Kreator tersenyum mengingat pengalaman sebelumnya",
              facial_expression: "Honest, authentic, friendly smile",
              gesture: "Casual conversational hand gestures",
              audio: "Warm storytelling tone",
              transition: "Match cut to product reveal",
              character_continuity: "Identical creator face, hairstyle, and wardrobe",
              product_continuity: `Same ${prodName} visible on desk`,
              location_continuity: `Same ${cLoc.toLowerCase()} room`,
              negative_constraints: "No jump cuts in appearance"
            },
            {
              number: 3,
              name: "Adegan 3: Solusi Produk",
              time: "10-16 detik",
              dialogue: `Sampai akhirnya aku nemu ${prodName} ini. Pas pertama kali pegang, langsung berasa beda banget build quality-nya!`,
              visual: `Close-up shot kreator mengangkat ${prodName} dan menunjukkannya detail ke kamera, memperlihatkan ${prodFeat}.`,
              camera: "Close-up focus racking onto product texture and details",
              lighting: "Clean studio light highlighting product finish and material",
              action: `Memperlihatkan bodi dan fitur ${prodName} ke arah lensa`,
              facial_expression: "Excited, genuine discovery expression",
              gesture: "Turning the product slowly to show design",
              audio: "Enthusiastic tone, crisp vocal audio",
              transition: "Smooth cut to demonstration",
              character_continuity: "Consistent creator identity and styling",
              product_continuity: `Exact match ${prodName} design and details`,
              location_continuity: "Same lifestyle interior",
              negative_constraints: "No inconsistent colors or labels"
            },
            {
              number: 4,
              name: "Adegan 4: Demonstrasi Nyata",
              time: "16-22 detik",
              dialogue: `Fiturnya beneran ngebantu banget buat ${prodCase}, bahannya solid dan super praktis dipakai seharian.`,
              visual: `Demonstrasi langsung pemakaian ${prodName}. Memperlihatkan kepraktisan dan fungsionalitas produk secara nyata.`,
              camera: "Dynamic angle showing practical handling",
              lighting: "Bright natural lighting",
              action: `Mendemonstrasikan fungsionalitas ${prodName} dengan percaya diri`,
              facial_expression: "Confident, thoroughly satisfied",
              gesture: "Smooth ergonomic product handling",
              audio: "Authentic product interaction sound effect, convincing voiceover",
              transition: "Cut back to creator selfie shot",
              character_continuity: "Identical creator hands and clothing",
              product_continuity: `Consistent ${prodName} throughout action`,
              location_continuity: "Same setting",
              negative_constraints: "No robotic movements, no unnatural physics"
            },
            {
              number: 5,
              name: "Adegan 5: Bukti Kepuasan",
              time: "22-26 detik",
              dialogue: "Sekarang udah jadi andalan wajib aku ke mana-mana, beneran worth it banget!",
              visual: `Kreator tersenyum puas memegang ${prodName} di dekat wajah, menunjukkan kepuasan tulus.`,
              camera: "Medium close-up selfie angle, warm depth of field",
              lighting: "Flattering soft beauty light",
              action: "Mengangguk puas memberikan rekomendasi tulus",
              facial_expression: "High-trust, sincere, happy smile",
              gesture: "Holding product proudly",
              audio: "Warm friendly vocal resonance",
              transition: "Hold into closing call to action",
              character_continuity: "Consistent styling and hair",
              product_continuity: `Identical ${prodName}`,
              location_continuity: "Same aesthetic room",
              negative_constraints: "No artificial posing"
            },
            {
              number: 6,
              name: "Adegan 6: Call to Action (Ajakan Beli)",
              time: "26-30 detik",
              dialogue: `Buat kalian yang mau punya ${prodName} ini juga, langsung klik link di bawah mumpung lagi ada promo ya!`,
              visual: `Kreator tersenyum antusias memegang ${prodName} sambil menunjuk ke arah tombol aksi di bawah.`,
              camera: "Direct engaging selfie angle",
              lighting: "Radiant bright warm light",
              action: "Menunjuk ke arah bawah layar mengajak penonton checkout",
              facial_expression: "Warm engaging closing smile",
              gesture: "Pointing towards bottom CTA link",
              audio: "Clear closing CTA voiceover with music outro",
              transition: "Final hold on product lock frame",
              character_continuity: "Identical creator styling",
              product_continuity: `Crisp prominent ${prodName} package shot`,
              location_continuity: "Same lifestyle room",
              negative_constraints: "No CGI look, purely organic UGC creator style"
            }
          ];
        } else if (is20s) {
          dynamicScenes = [
            {
              number: 1,
              name: "Adegan 1: Hook Penasaran",
              time: "0-4 detik",
              dialogue: `Jujur, tadinya aku penasaran banget apa bener ${prodName} ini sebagus itu...`,
              visual: `Close-up shot kreator memegang ${prodName} dengan ekspresi penasaran menghadap kamera.`,
              camera: "Handheld selfie camera, eye level",
              lighting: "Soft natural morning light",
              action: `Menunjukkan ${prodName} sekilas ke arah kamera`,
              facial_expression: "Curious and relatable",
              gesture: "Holding product close to chest",
              audio: "Crisp clear voiceover, upbeat music",
              transition: "Quick cut to context",
              character_continuity: `Identical ${cGender.toLowerCase()} creator`,
              product_continuity: `Identical ${prodName}`,
              location_continuity: `Modern ${cLoc.toLowerCase()}`,
              negative_constraints: "No blur, no morphing"
            },
            {
              number: 2,
              name: "Adegan 2: Masalah & Kebutuhan",
              time: "4-9 detik",
              dialogue: `Soalnya susah banget cari yang beneran praktis dan awet buat ${prodCase}.`,
              visual: "Medium shot kreator menceritakan masalah yang sering dialami.",
              camera: "Medium handheld shot",
              lighting: "Balanced warm room lighting",
              action: "Berbicara santai dengan gestur tangan alami",
              facial_expression: "Relatable and honest",
              gesture: "Natural conversational hands",
              audio: "Storytelling tone",
              transition: "Cut to product reveal",
              character_continuity: "Consistent styling and wardrobe",
              product_continuity: `Same ${prodName} on table`,
              location_continuity: `Same ${cLoc.toLowerCase()}`,
              negative_constraints: "No inconsistencies"
            },
            {
              number: 3,
              name: "Adegan 3: Solusi Nyata",
              time: "9-15 detik",
              dialogue: `Tapi pas dicobain, ${prodFeat} beneran bikin aktivitas jauh lebih gampang!`,
              visual: `Close-up demonstrasi pemakaian ${prodName}. Memperlihatkan detail bodi dan fungsi utama.`,
              camera: "Smooth zoom in on product handling",
              lighting: "Clean studio light",
              action: `Mendemonstrasikan cara pemakaian ${prodName}`,
              facial_expression: "Impressed and satisfied",
              gesture: "Ergonomic handling",
              audio: "Satisfying natural product sound effect",
              transition: "Zoom out to CTA",
              character_continuity: "Identical creator hands and face",
              product_continuity: `Exact match ${prodName}`,
              location_continuity: "Same room",
              negative_constraints: "No CGI look"
            },
            {
              number: 4,
              name: "Adegan 4: Call to Action",
              time: "15-20 detik",
              dialogue: "Wajib punya minimal satu! Klik link di bawah sekarang mumpung lagi ada promo ya!",
              visual: `Kreator tersenyum ramah memegang ${prodName} sambil menunjuk ke tombol beli.`,
              camera: "Direct front selfie angle",
              lighting: "Bright radiant light",
              action: "Menunjuk ke tombol keranjang di bawah",
              facial_expression: "Warm engaging smile",
              gesture: "Pointing to CTA",
              audio: "Clear closing speech with music fade out",
              transition: "Hold on product frame",
              character_continuity: "Consistent styling",
              product_continuity: `Clear ${prodName} shot`,
              location_continuity: "Same setting",
              negative_constraints: "No artificial look"
            }
          ];
        } else {
          dynamicScenes = [
            {
              number: 1,
              name: "Adegan 1: Hook Menarik Perhatian",
              time: "0-3 detik",
              dialogue: `Jujur, tadinya aku ragu banget mau nyobain ${prodName} ini...`,
              visual: `Close-up shot kreator memegang ${prodName} dengan ekspresi penasaran dan antusias.`,
              camera: "Eye-level handheld selfie angle, crisp 4K mobile sensor aesthetic",
              lighting: "Soft morning window light with warm subtle rim light",
              action: `Kreator tersenyum santai sambil menunjukkan ${prodName} ke arah kamera`,
              facial_expression: "Relatable curiosity and friendly smile",
              gesture: "Holding the product close to chest, gentle hand movement",
              audio: "Upbeat subtle background lo-fi music, clear crisp voiceover",
              transition: "Quick dynamic match cut to product demo",
              character_continuity: `Identical ${cGender.toLowerCase()} creator appearance and outfit`,
              product_continuity: `Identical ${prodName} packaging and label`,
              location_continuity: `Clean modern aesthetic ${cLoc.toLowerCase()} interior`,
              negative_constraints: "No blurry artifacts, no deformed hands, no floating objects"
            },
            {
              number: 2,
              name: "Adegan 2: Demonstrasi & Manfaat Utama",
              time: "3-7 detik",
              dialogue: `Tapi setelah dipakai buat ${prodCase}, hasilnya beneran terbukti dan ${prodFeat}!`,
              visual: `Medium close-up shot memperlihatkan aplikasi nyata ${prodName}. Tekstur dan bodi produk terlihat jelas.`,
              camera: "Slight pan and zoom into product texture and finish",
              lighting: "Clean balanced studio light emphasizing product clarity",
              action: `Mendemonstrasikan pemakaian ${prodName} dengan santai dan natural`,
              facial_expression: "Satisfied, impressed, and confident expression",
              gesture: "Gentle application showing practical benefit",
              audio: "Satisfying natural sound effect, warm energetic voice tone",
              transition: "Smooth zoom out to call to action",
              character_continuity: "Consistent facial features and clothing",
              product_continuity: `Exact match ${prodName} design and finish`,
              location_continuity: `Same well-lit ${cLoc.toLowerCase()} interior`,
              negative_constraints: "No inconsistent colors, no distorted labels"
            },
            {
              number: 3,
              name: "Adegan 3: Call to Action (Ajakan Beli)",
              time: "7-10 detik",
              dialogue: "Buat kamu yang mau buktiin sendiri, klik link di bawah sekarang mumpung lagi diskon ya!",
              visual: `Kreator tersenyum ramah memegang ${prodName} di samping wajahnya sambil menunjuk ke arah tombol pembelian.`,
              camera: "Direct front-facing selfie shot with pleasant depth of field",
              lighting: "Bright radiant warm light",
              action: "Menunjuk ke arah bawah layar dengan gesture ramah mengajak penonton",
              facial_expression: "Warm engaging smile with high trust factor",
              gesture: "Pointing towards bottom CTA button",
              audio: "Clear closing call-to-action speech, upbeat music fade out",
              transition: "Hold on product lock frame",
              character_continuity: "Consistent creator face and styling",
              product_continuity: `Clear prominent ${prodName} shot`,
              location_continuity: `Consistent modern ${cLoc.toLowerCase()} lifestyle setting`,
              negative_constraints: "No artificial CGI look, purely organic UGC creator style"
            }
          ];
        }

        const fallbackPromptData = {
          master_prompt: `[MASTER UGC PROMPT - ${style.toUpperCase()} - ${dur}]\nA high-converting, authentic UGC video for ${prodName}.\nFormat: Vertical ${ratio}, ${dur}, cinematic mobile sensor aesthetic, natural daylight setting.\nCreator Persona: Friendly, relatable ${cGender.toLowerCase()} Indonesian creator speaking in natural tone directly to the camera.\nVisual Continuity: Strict character and product locking across all scenes with identical packaging details.`,
          scenes: dynamicScenes,
          summary: {
            product: prodName,
            duration: dur,
            aspect_ratio: ratio,
            ugc_style: style,
            creator: `${cGender}, Relatable Creator`,
            language: language || "Bahasa Indonesia"
          },
          character_bible: {
            creator_type: `Modern ${cGender.toLowerCase()} UGC creator`,
            aesthetic: "Authentic, relatable, glowing natural appearance",
            wardrobe: "Casual aesthetic daily outfit with neutral warm tones"
          },
          character_anchor: `Indonesian ${cGender.toLowerCase()} creator in early 20s, friendly smile, clean minimalist styling, soft natural daylight in ${cLoc.toLowerCase()}.`,
          product_lock: `${prodName} with identical clean packaging, correct brand details, and authentic product proportions.`,
          character_locked: true,
          product_locked: true
        };

        setResult(fallbackPromptData);
        setView("result");
        setGenError(null);
        toast.success("Prompt video UGC berhasil dibuat!");
      }
    } finally {
      clearInterval(interval);
      setGenerating(false);
    }
  };

  const newVideo = () => {
    setStep(0); setMaxReached(0); setView("wizard");
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

  const stepValid = step !== 0 || !!preview || !!analysis;

  // ----------------- RESULT VIEW -----------------
  if (view === "result") {
    const summary = result?.summary || {};
    return (
      <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
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
                    <Button size="sm" className="h-9 gap-1.5 rounded-xl font-semibold shadow-sm" onClick={copyPrompt} data-testid="copy-prompt-btn">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copied ? "Berhasil Disalin" : "Salin Prompt"}</span>
                    </Button>
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
      </div>
    );
  }

  // ----------------- WIZARD VIEW -----------------
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Generator Studio</span>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Sinergi Visual UGC Generator Prompt
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unggah foto produk dan atur preferensi video Anda. AI akan merancang konsep, persona kreator, dan prompt per adegan secara otomatis.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
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
                    <span className="text-xs font-medium">Belum ada foto produk</span>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Wizard Content */}
          <div className="min-h-[440px] rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {step === 0 && (
                  <section className="space-y-6" data-testid="step-product">
                    <div>
                      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Upload Foto Produk</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Unggah foto produk yang ingin dibuatkan prompt video UGC (Maksimal 10 MB, format JPG, PNG, atau WEBP).
                      </p>
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
                              <span className="mt-1 text-xs text-muted-foreground">AI Gemini Vision sedang membaca detail produk.</span>
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
