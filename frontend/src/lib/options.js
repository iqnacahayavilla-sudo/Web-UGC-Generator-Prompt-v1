// All selectable options for the studio wizard. Labels are Indonesian (UI language);
// VALUES are kept in English because the backend prompt engine keys on them.

export const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16", hint: "TikTok / Reels / Shorts" },
  { value: "1:1", label: "1:1", hint: "Kotak" },
  { value: "16:9", label: "16:9", hint: "YouTube" },
];

export const DURATIONS = [
  { value: "10 seconds", label: "10 Detik" },
  { value: "20 seconds", label: "20 Detik" },
  { value: "30 seconds", label: "30 Detik" },
];

export const UGC_STYLES = [
  { value: "Talking Head", label: "Ngomong Langsung ke Kamera" },
  { value: "Product Review", label: "Review Produk" },
  { value: "Unboxing", label: "Unboxing" },
  { value: "Problem \u2192 Solution", label: "Masalah \u2192 Solusi" },
  { value: "Soft Selling", label: "Jualan Soft" },
  { value: "Hard Selling", label: "Jualan Langsung" },
  { value: "POV", label: "POV" },
  { value: "Storytelling", label: "Storytelling" },
  { value: "Product Demo", label: "Demo Produk" },
  { value: "Before \u2192 After", label: "Sebelum \u2192 Sesudah" },
];

export const HOOK_STYLES = [
  { value: "Curiosity", label: "Rasa Penasaran" },
  { value: "Problem", label: "Masalah" },
  { value: "Bold Statement", label: "Pernyataan Mengejutkan" },
  { value: "Personal Experience", label: "Pengalaman Pribadi" },
  { value: "Product Discovery", label: "Penemuan Produk" },
  { value: "Before / After", label: "Sebelum & Sesudah" },
  { value: "AI Chooses", label: "AI Pilihkan" },
];

export const SELLING_STYLES = [
  { value: "Soft Sell", label: "Jualan Soft", hint: "Terasa seperti berbagi rekomendasi, bukan iklan." },
  { value: "Natural Recommendation", label: "Rekomendasi Natural", hint: "Seperti kreator menceritakan pengalaman pribadi." },
  { value: "Direct Selling", label: "Jualan Langsung", hint: "Lebih fokus ke produk dan ajakan membeli." },
  { value: "Urgency / Promo", label: "Promo / Urgensi", hint: "Cocok untuk promo, diskon, atau penawaran terbatas." },
];

export const GENDERS = [
  { value: "Female", label: "Perempuan" },
  { value: "Male", label: "Laki-laki" },
  { value: "Any", label: "Bebas / AI Pilihkan" },
];

export const AGES = [
  { value: "18-24", label: "18\u201324 tahun" },
  { value: "25-34", label: "25\u201334 tahun" },
  { value: "35-44", label: "35\u201344 tahun" },
  { value: "45+", label: "45+ tahun" },
  { value: "AI Chooses", label: "AI Pilihkan" },
];

export const PERSONALITIES = [
  { value: "Friendly", label: "Ramah" },
  { value: "Energetic", label: "Energik" },
  { value: "Calm", label: "Tenang" },
  { value: "Relatable", label: "Relatable" },
  { value: "Funny", label: "Lucu" },
  { value: "Premium", label: "Premium" },
  { value: "Confident", label: "Percaya Diri" },
];

export const SPEAKING_STYLES = [
  { value: "Natural", label: "Natural" },
  { value: "Casual", label: "Santai" },
  { value: "Gen Z", label: "Gaya Gen Z" },
  { value: "Professional", label: "Profesional" },
  { value: "Luxury", label: "Elegan" },
  { value: "Funny", label: "Lucu" },
];

export const LOCATIONS = [
  { value: "Bedroom", label: "Kamar Tidur" },
  { value: "Living Room", label: "Ruang Tamu" },
  { value: "Bathroom", label: "Kamar Mandi" },
  { value: "Kitchen", label: "Dapur" },
  { value: "Office", label: "Kantor" },
  { value: "Cafe", label: "Kafe" },
  { value: "Outdoor", label: "Outdoor" },
  { value: "Studio", label: "Studio" },
  { value: "Product Appropriate", label: "Sesuai Produk" },
  { value: "AI Chooses", label: "AI Pilihkan" },
];

export const LANGUAGES = [
  { value: "Bahasa Indonesia", label: "Bahasa Indonesia" },
  { value: "English", label: "Bahasa Inggris" },
  { value: "Malay", label: "Bahasa Melayu" },
];

export const DEFAULT_VIDEO = {
  aspect_ratio: "9:16",
  duration: "10 seconds",
  ugc_style: "Problem \u2192 Solution",
  hook_style: "AI Chooses",
  selling_style: "Natural Recommendation",
};

export const DEFAULT_CREATOR = {
  gender: "Any",
  age: "AI Chooses",
  personality: "Relatable",
  speaking_style: "Natural",
  location: "Product Appropriate",
};

export const QUICK_ACTIONS = [
  { label: "Buat Lebih Viral", modifier: "Make the whole video more viral and scroll-stopping with a punchier hook and higher energy. Keep the SAME creator and product." },
  { label: "Buat Lebih Natural", modifier: "Make it feel more natural, authentic and less scripted, like a real casual phone video. Keep the SAME creator and product." },
  { label: "Kurangi Kesan Jualan", modifier: "Make it less salesy and more genuine; soften the pitch and CTA. Keep the SAME creator and product." },
  { label: "Buat Lebih Premium", modifier: "Give it a more premium, aspirational feel in visuals, wardrobe and tone, but keep the SAME creator identity and product." },
  { label: "Buat Hook Baru", modifier: "Keep the SAME creator and product, but write a completely different, fresh hook." },
  { label: "Ganti Kreator", modifier: "Cast a DIFFERENT creator persona for this video.", forceNewCharacter: true },
  { label: "Ganti Lokasi", modifier: "Keep the SAME creator and product, but set it in a different, fitting location." },
];
