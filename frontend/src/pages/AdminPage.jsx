import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  UserPlus,
  Users,
  Coins,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Sparkles,
  Zap,
  Crown,
  Search,
  Plus,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  createMemberByAdmin,
  getMembersListByAdmin,
  adjustMemberCreditsByAdmin,
} from "@/lib/supabaseAdmin";

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("create"); // 'create' | 'members'

  // Form State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    initialCredits: 100,
    planType: "free",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Members List State
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Top Up Modal / Quick Action
  const [selectedMember, setSelectedMember] = useState(null);
  const [creditAmount, setCreditAmount] = useState(50);
  const [isUpdatingCredit, setIsUpdatingCredit] = useState(false);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pass }));
  };

  // Fetch Member List directly from Supabase profiles table
  const fetchMembers = React.useCallback(async () => {
    setLoadingMembers(true);
    try {
      // 1. Panggil query langsung menggunakan supabaseAdmin (Service Role / Public)
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        setMembers(data);
        return;
      }

      if (error) {
        console.warn("supabaseAdmin profiles query notice:", error.message);
      }

      // 2. Fallback jika supabaseAdmin query perlu helper
      const res = await getMembersListByAdmin(100);
      if (res?.success && Array.isArray(res.users) && res.users.length > 0) {
        setMembers(res.users);
      } else if (Array.isArray(data)) {
        setMembers(data);
      }
    } catch (e) {
      console.warn("Gagal memuat daftar member:", e);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Handle Create Member via direct Supabase Admin SDK
  const handleCreateMember = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.fullName) {
      toast.error("Semua field wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createMemberByAdmin({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        initialCredits: Number(formData.initialCredits) || 100,
        planType: formData.planType,
      });

      if (data?.success) {
        toast.success(`Akun member ${formData.email} berhasil dibuat!`);
        setCreatedResult({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          fullName: formData.fullName.trim(),
          credits: Number(formData.initialCredits) || 100,
          planType: formData.planType,
        });
        // Reset form
        setFormData({
          email: "",
          password: "",
          fullName: "",
          initialCredits: 100,
          planType: "free",
        });
        fetchMembers();
      } else {
        toast.error("Gagal membuat akun member.");
      }
    } catch (e) {
      const msg = e?.message || "Terjadi kendala saat membuat akun member via Supabase Admin.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy credentials message for sending to member
  const copyCredentialsText = () => {
    if (!createdResult) return;
    const text = `Halo ${createdResult.fullName}! 👋\n\nSelamat, akun Private Member Area *Sinergi Visual UGC Video Prompt Generator* Anda telah aktif.\n\nBerikut data login Anda:\n🌐 Link Portal: ${window.location.origin}/login\n📧 Email: ${createdResult.email}\n🔑 Password: ${createdResult.password}\n⚡ Kuota Kredit: ${createdResult.credits} Token\n⭐ Paket: ${createdResult.planType.toUpperCase()}\n\nSilakan masuk dan mulai buat prompt video UGC viral Anda!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Kredensial member berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Add / Adjust credits via direct Supabase Admin SDK
  const handleAddCredits = async (memberId) => {
    setIsUpdatingCredit(true);
    try {
      const data = await adjustMemberCreditsByAdmin(
        memberId,
        Number(creditAmount) || 50,
        "add"
      );
      if (data?.success) {
        toast.success(`Berhasil menambahkan ${creditAmount} kredit!`);
        setSelectedMember(null);
        fetchMembers();
      }
    } catch (e) {
      toast.error(e?.message || "Gagal memperbarui kredit.");
    } finally {
      setIsUpdatingCredit(false);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8">
        {/* Header Admin */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Shield className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Super Administrator Portal
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Manajemen Member & Kredit (Invite-Only)
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Buat akun member baru secara resmi, atur saldo token, dan kelola akses pengguna.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
                <span>Ke Member Area</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="mt-6 flex items-center gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              activeTab === "create"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>Buat Akun Member Baru</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("members");
              fetchMembers();
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Daftar Member ({members.length})</span>
          </button>
        </div>

        {/* TAB 1: CREATE MEMBER FORM */}
        {activeTab === "create" && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Form Section */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary tracking-wider">
                <Sparkles className="h-4 w-4" /> Form Registrasi Akun Member
              </div>
              <h2 className="mt-1 font-display text-xl font-bold text-foreground">
                Daftarkan Pengguna Baru
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Akun yang dibuat akan langsung tersimpan di Supabase Auth & Profiles dengan kredensial yang Anda tentukan.
              </p>

              <form onSubmit={handleCreateMember} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Nama Lengkap Member</span>
                  </label>
                  <Input
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="h-11 rounded-xl bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Alamat Email Member</span>
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="member@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-11 rounded-xl bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Kata Sandi (Password)</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Acak Password
                    </button>
                  </div>
                  <Input
                    required
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-11 rounded-xl bg-background font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Kredit Awal</span>
                    </label>
                    <Input
                      type="number"
                      required
                      min={10}
                      value={formData.initialCredits}
                      onChange={(e) => setFormData({ ...formData, initialCredits: e.target.value })}
                      className="h-11 rounded-xl bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Paket Akses</span>
                    </label>
                    <select
                      value={formData.planType}
                      onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="free">Free Member (100 Token/Hari)</option>
                      <option value="pro">Pro Member (1.000 Token/Hari)</option>
                      <option value="enterprise">Enterprise Studio (5.000 Token/Hari)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-4 h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg"
                >
                  {isSubmitting ? (
                    <span>Membuat Akun Member...</span>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Buat Akun Member Sekarang</span>
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Created Output & Copy Section */}
            <div className="space-y-5">
              {createdResult ? (
                <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-6 shadow-md animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Akun Berhasil Dibuat!
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-foreground">
                    Kredensial Member Baru
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Salin informasi di bawah ini dan kirimkan langsung kepada member via WhatsApp / Email.
                  </p>

                  <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4 text-xs font-mono">
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground font-sans">Nama:</span>
                      <span className="font-bold text-foreground">{createdResult.fullName}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground font-sans">Email:</span>
                      <span className="font-bold text-foreground">{createdResult.email}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground font-sans">Password:</span>
                      <span className="font-bold text-primary">{createdResult.password}</span>
                    </div>
                    <div className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="text-muted-foreground font-sans">Saldo Token:</span>
                      <span className="font-bold text-foreground">{createdResult.credits} Token</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-sans">Paket:</span>
                      <span className="font-bold uppercase text-amber-500">{createdResult.planType}</span>
                    </div>
                  </div>

                  <Button
                    onClick={copyCredentialsText}
                    className="mt-4 h-11 w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? "Tersalin ke Clipboard!" : "Salin Format Chat untuk Member"}</span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-secondary/20 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground mb-3">
                    <Copy className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-foreground">Kredensial Siap Kirim</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Setelah akun dibuat, format pesan login lengkap akan otomatis tampil di sini dan siap Anda salin ke WhatsApp/Email member.
                  </p>
                </div>
              )}

              {/* Quick Info Box */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 text-xs text-muted-foreground space-y-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Kebijakan Private Member Area:</span>
                </div>
                <p>• Akses registrasi publik dimatikan. Hanya akun yang terdaftar melalui form ini yang dapat login ke portal.</p>
                <p>• Setiap member akan mendapatkan kuota harian otomatis yang di-reset pukul 00:00 WIB sesuai paket.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEMBERS DIRECTORY */}
        {activeTab === "members" && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan email atau nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-card text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMembers}
                disabled={loadingMembers}
                className="h-10 gap-1.5 rounded-xl text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingMembers ? "animate-spin" : ""}`} />
                <span>Refresh Data</span>
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/80 bg-secondary/40 text-[11px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">Nama & Email Member</th>
                      <th className="px-4 py-3.5">Paket</th>
                      <th className="px-4 py-3.5">Saldo Kredit</th>
                      <th className="px-4 py-3.5">Terdaftar Sejak</th>
                      <th className="px-4 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map((m) => {
                        const uid = m.id || m.user_id;
                        return (
                          <tr key={uid || m.email} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-foreground">{m.full_name || "Kreator Sinergi"}</div>
                              <div className="text-muted-foreground font-mono text-[11px]">{m.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                                {m.plan_type || "free"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-display font-extrabold text-foreground">{m.credits ?? 100}</span>{" "}
                              <span className="text-muted-foreground">Token</span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-[11px]">
                              {m.created_at ? new Date(m.created_at).toLocaleDateString("id-ID") : "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 rounded-lg text-xs font-semibold"
                                onClick={() => setSelectedMember(m)}
                              >
                                <Plus className="h-3 w-3" />
                                <span>Tambah Kredit</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          {loadingMembers ? "Memuat daftar member..." : "Belum ada data member terdaftar."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Quick Add Credits */}
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
                <Coins className="h-4 w-4" /> Tambah Saldo Token Member
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-foreground">
                {selectedMember.full_name || selectedMember.email}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedMember.email}</p>

              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold text-foreground">Jumlah Token yang Ditambahkan:</label>
                <div className="flex gap-2">
                  {[50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreditAmount(amt)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                        creditAmount === amt ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-secondary/40 hover:bg-secondary"
                      }`}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="h-10 rounded-xl bg-background text-xs mt-2"
                />
              </div>

              <div className="mt-6 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-10 text-xs"
                  onClick={() => setSelectedMember(null)}
                >
                  Batal
                </Button>
                <Button
                  disabled={isUpdatingCredit}
                  className="flex-1 rounded-xl h-10 text-xs font-bold"
                  onClick={() => handleAddCredits(selectedMember.id || selectedMember.user_id)}
                >
                  {isUpdatingCredit ? "Menyimpan..." : "Simpan Kredit"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
