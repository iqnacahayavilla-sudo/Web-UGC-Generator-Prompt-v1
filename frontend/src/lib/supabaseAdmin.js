import { createClient } from "@supabase/supabase-js";

// Ambil kredensial Supabase URL dan Service Role Key dari Environment Variables
const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://rsqhvxovsqidmrvjndyq.supabase.co";

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

// Kunci Service Role khusus Super Admin (Bypass RLS & Akses Auth Admin)
const supabaseServiceRoleKey =
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

export const isServiceRoleAvailable = Boolean(
  supabaseServiceRoleKey &&
  supabaseServiceRoleKey.length > 20
);

// Inisialisasi Supabase Admin Client dengan persistSession: false agar tidak mengganggu/menimpa sesi login admin
export const supabaseAdmin = createClient(
  supabaseUrl,
  isServiceRoleAvailable ? supabaseServiceRoleKey : supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Membuat akun member baru secara langsung via Supabase Admin SDK
 * Menggunakan Service Role Key dengan persistSession: false agar sesi Admin utama tidak tertimpa.
 */
export async function createMemberByAdmin({
  email,
  password,
  fullName,
  initialCredits = 100,
  planType = "free",
}) {
  const cleanEmail = email.trim().toLowerCase();
  const creditsNum = parseInt(initialCredits, 10) || 100;
  const nowIso = new Date().toISOString();

  let userId = null;
  let createdUser = null;

  // 1. Jika Service Role Key tersedia, gunakan auth.admin.createUser (email langsung terkonfirmasi)
  if (isServiceRoleAvailable) {
    try {
      const { data: adminData, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          plan_type: planType,
        },
      });

      if (!adminErr && adminData?.user?.id) {
        userId = adminData.user.id;
        createdUser = adminData.user;
      } else if (adminErr) {
        console.warn("auth.admin.createUser notice:", adminErr.message);
      }
    } catch (e) {
      console.warn("auth.admin error:", e);
    }
  }

  // 2. Jika auth.admin.createUser belum berhasil (misal Service Role belum diset di browser env), gunakan SignUp dengan persistSession: false
  if (!userId) {
    // Buat client terisolasi khusus proses pendaftaran tanpa persistensi sesi lokal
    const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: fullName,
          plan_type: planType,
        },
      },
    });

    if (signUpError) {
      console.error("Supabase SignUp fallback error:", signUpError);
      throw new Error(signUpError.message || "Gagal mendaftarkan akun member baru.");
    }

    if (signUpData?.user?.id) {
      userId = signUpData.user.id;
      createdUser = signUpData.user;
    } else {
      userId = `usr_${Date.now()}`;
    }
  }

  // 3. Simpan data profil ke tabel `profiles`
  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert([
      {
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        credits: creditsNum,
        plan_type: planType,
        updated_at: nowIso,
      },
    ]);

    if (profileError) {
      console.warn("profiles upsert notice:", profileError.message);
    }
  } catch (err) {
    console.warn("Error inserting profile:", err);
  }

  // 4. Simpan data saldo ke tabel `user_credits`
  try {
    const { error: creditsError } = await supabaseAdmin.from("user_credits").upsert([
      {
        user_id: userId,
        daily_quota: creditsNum,
        daily_credits_remaining: creditsNum,
        bonus_credits: 0,
        last_reset_date: nowIso.substring(0, 10),
        updated_at: nowIso,
      },
    ]);

    if (creditsError) {
      console.warn("user_credits upsert notice:", creditsError.message);
    }
  } catch (err) {
    console.warn("Error inserting user_credits:", err);
  }

  return {
    success: true,
    user: createdUser,
    user_id: userId,
    email: cleanEmail,
    fullName: fullName,
    credits: creditsNum,
    planType: planType,
  };
}

/**
 * Mengambil daftar seluruh member langsung dari tabel `profiles` Supabase
 */
export async function getMembersListByAdmin(limit = 100) {
  if (!supabaseAdmin) return { success: false, users: [] };

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Supabase get members list error:", error);
      return { success: false, users: [], error: error.message };
    }

    return { success: true, count: data?.length || 0, users: data || [] };
  } catch (err) {
    console.warn("Error fetching members list:", err);
    return { success: false, users: [], error: err.message };
  }
}

/**
 * Menambah atau mengatur saldo kredit member via Supabase Admin SDK
 */
export async function adjustMemberCreditsByAdmin(userId, amount, mode = "add") {
  if (!supabaseAdmin) throw new Error("Supabase Admin client belum siap.");

  const nowIso = new Date().toISOString();

  // 1. Ambil saldo terkini
  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  const currentCredits = profileData?.credits || 0;
  const newBalance =
    mode === "add" ? currentCredits + parseInt(amount, 10) : Math.max(0, parseInt(amount, 10));

  // 2. Update tabel `profiles`
  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({ credits: newBalance, updated_at: nowIso })
    .eq("id", userId);

  if (profErr) throw new Error(profErr.message);

  // 3. Update tabel `user_credits`
  try {
    await supabaseAdmin
      .from("user_credits")
      .update({ daily_credits_remaining: newBalance, updated_at: nowIso })
      .eq("user_id", userId);
  } catch (e) {}

  return {
    success: true,
    user_id: userId,
    previous_credits: currentCredits,
    new_credits: newBalance,
  };
}
