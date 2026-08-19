import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const fileUrl = (path) => `${API}/files/${path}`;

export async function directOpenAIAnalyze(base64Data, apiKey) {
  const prompt = `Analisis foto produk ini dengan teliti. Ekstrak data dalam format JSON murni dengan schema:
{
  "product_name": "nama produk presisi dari foto (misal: Sepatu On Running Cloudmonster / SK-II Facial Treatment Essence / Tumbler Stanley)",
  "category": "kategori produk (misal: Fashion & Footwear / Beauty & Skincare / Home & Living)",
  "product_type": "jenis spesifik (misal: Running Shoes / Essence / Tumbler)",
  "brand": "merek yang terlihat jelas di foto",
  "dominant_colors": ["warna 1", "warna 2"],
  "materials": ["material 1", "material 2"],
  "packaging_description": "deskripsi bentuk, kemasan, atau bodi produk",
  "visual_features": ["fitur visual utama", "desain unik"],
  "likely_use_case": "kegunaan produk sehari-hari",
  "target_audience": "target konsumen",
  "visible_text": "teks atau logo yang terbaca",
  "product_positioning": "posisi produk (premium / trendy / sporty / luxury)"
}`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an expert AI product vision analyst. Output JSON only."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64Data } }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    }
  );

  const raw = response?.data?.choices?.[0]?.message?.content;
  return JSON.parse(raw);
}

export async function analyzeImage(file) {
  const toBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const base64Data = await toBase64(file);

  // 1. Coba backend POST /api/analyze (JSON payload)
  try {
    const { data } = await axios.post(
      `${API}/analyze`,
      { image_base64: base64Data, filename: file.name },
      { headers: { "Content-Type": "application/json" } }
    );
    if (data && data.product_analysis) return data;
  } catch (err1) {
    console.warn("Backend JSON /api/analyze notice:", err1?.response?.status || err1.message);
  }

  // 2. Coba backend POST /api/analyze (Multipart Form-Data)
  try {
    const form = new FormData();
    form.append("file", file);
    const { data } = await axios.post(`${API}/analyze`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (data && data.product_analysis) return data;
  } catch (err2) {
    console.warn("Backend FormData /api/analyze notice:", err2?.response?.status || err2.message);
  }

  // 3. Direct OpenAI Vision API jika REACT_APP_OPENAI_API_KEY tersedia
  const clientKey =
    process.env.REACT_APP_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    (typeof window !== "undefined" && window.ENV?.OPENAI_API_KEY);

  if (clientKey) {
    try {
      const analysis = await directOpenAIAnalyze(base64Data, clientKey);
      return {
        project_id: `proj_${Date.now()}`,
        product_image_path: "",
        product_analysis: analysis
      };
    } catch (clientErr) {
      console.error("Direct OpenAI Vision error:", clientErr);
    }
  }

  throw new Error("Gagal menganalisis produk via backend AI. Silakan periksa status koneksi / backend API.");
}



export async function generatePrompt(projectId, payload) {
  const { data } = await axios.post(`${API}/projects/${projectId}/generate`, payload);
  return data;
}

export async function adminCreateUser(payload) {
  const { data } = await axios.post(`${API}/admin/users/create`, payload, {
    headers: { "Content-Type": "application/json" }
  });
  return data;
}

export async function adminGetUsers(adminEmail) {
  const { data } = await axios.get(`${API}/admin/users`, {
    params: { admin_email: adminEmail }
  });
  return data;
}

export async function adminAdjustCredits(payload) {
  const { data } = await axios.post(`${API}/admin/users/adjust-credits`, payload, {
    headers: { "Content-Type": "application/json" }
  });
  return data;
}

export async function getUserProjects(userId) {
  try {
    const { data } = await axios.get(`${API}/projects`, {
      params: { user_id: userId }
    });
    return data;
  } catch (e) {
    return { success: false, projects: [] };
  }
}

