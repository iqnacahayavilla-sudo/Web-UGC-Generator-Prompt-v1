import { createClient } from "@supabase/supabase-js";

// Ambil kredensial Supabase dari berbagai format environment variable yang umum
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-supabase") &&
  supabaseUrl.startsWith("http")
);

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
 * Mendaftar akun baru dengan Email & Password via Supabase Auth
 */
export async function signUpWithEmailPassword({ email, password, fullName }) {
  if (!isSupabaseConfigured || !supabase) {
    // Mode Simulasi / Fallback jika kunci Supabase belum diset
    const simulatedUser = {
      id: `usr_${Date.now()}`,
      email,
      user_metadata: {
        full_name: fullName || email.split("@")[0],
        avatar_url: null,
      },
      plan_type: "free",
    };
    try {
      localStorage.setItem("sinergi_auth_user", JSON.stringify(simulatedUser));
    } catch (e) {}
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null, simulated: true };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  if (error) return { data: null, error, simulated: false };

  // Otomatis sinkronkan profil user ke tabel public.users & public.user_credits jika sesi langsung aktif
  if (data?.user) {
    try {
      await supabase.from("users").upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName || data.user.email.split("@")[0],
        plan_type: "free",
      });

      await supabase.from("user_credits").upsert({
        user_id: data.user.id,
        daily_quota: 100,
        daily_credits_remaining: 100,
        bonus_credits: 10,
      });
    } catch (dbErr) {
      console.warn("Supabase public table upsert warning (trigger may handle it):", dbErr);
    }
  }

  return { data, error: null, simulated: false };
}

/**
 * Masuk dengan Email & Password via Supabase Auth
 */
export async function signInWithEmailPassword({ email, password }) {
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
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null, simulated: true };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error, simulated: false };
}

/**
 * Login dengan Google OAuth via Supabase
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
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
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null, simulated: true };
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
export async function signInWithEmailOtp(email) {
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
    return { data: { user: simulatedUser, session: { user: simulatedUser } }, error: null, simulated: true };
  }

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  return { data, error, simulated: false };
}

export const signInWithEmail = signInWithEmailOtp;

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
 * Ambil User dan Sesi yang sedang aktif
 */
export async function getCurrentUser() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return session.user;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
    } catch (e) {
      console.warn("Gagal membaca session Supabase:", e);
    }
  }

  try {
    const raw = localStorage.getItem("sinergi_auth_user");
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return null;
}

/**
 * Ambil Profile & Credits User langsung dari Supabase Database
 */
export async function getUserProfile(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) return null;

  try {
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const { data: credits } = await supabase
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      profile,
      credits,
    };
  } catch (e) {
    console.warn("Gagal mengambil profil dari Supabase:", e);
    return null;
  }
}
