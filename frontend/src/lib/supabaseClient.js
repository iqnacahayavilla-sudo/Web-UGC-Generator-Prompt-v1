import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-supabase"));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Login dengan Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
    // Mode Simulasi / Fallback jika kunci Supabase belum diset
    const simulatedUser = {
      id: `usr_${Date.now()}`,
      email: "kreator.sinergi@gmail.com",
      user_metadata: {
        full_name: "Kreator Sinergi",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      },
      plan_type: "free",
    };
    try {
      localStorage.setItem("sinergi_auth_user", JSON.stringify(simulatedUser));
    } catch (e) {}
    return { data: { user: simulatedUser }, error: null, simulated: true };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  return { data, error, simulated: false };
}

/**
 * Login dengan Email Magic Link / OTP via Supabase
 */
export async function signInWithEmail(email) {
  if (!isSupabaseConfigured || !supabase) {
    const simulatedUser = {
      id: `usr_${Date.now()}`,
      email,
      user_metadata: {
        full_name: email.split("@")[0],
        avatar_url: null,
      },
      plan_type: "free",
    };
    try {
      localStorage.setItem("sinergi_auth_user", JSON.stringify(simulatedUser));
    } catch (e) {}
    return { data: { user: simulatedUser }, error: null, simulated: true };
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  return { data, error, simulated: false };
}

/**
 * Logout dari sesi Supabase
 */
export async function signOutUser() {
  try {
    localStorage.removeItem("sinergi_auth_user");
  } catch (e) {}

  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  return { success: true };
}

/**
 * Ambil User yang sedang aktif
 */
export async function getCurrentUser() {
  if (isSupabaseConfigured && supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;
  }

  try {
    const raw = localStorage.getItem("sinergi_auth_user");
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return null;
}
