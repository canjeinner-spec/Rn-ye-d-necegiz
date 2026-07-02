import { searchProfiles, type PublicProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

/** Platform rolü ata (yalnızca super_admin — 024_platform_rol.sql). */
export async function setPlatformRole(userId: number, rol: "user" | "developer" | "super_admin"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("platform_rol_ata", { p_hedef: userId, p_rol: rol });
  if (error) throw error;
}

/** Yönetim ekranı üst sayıları. */
export async function getAdminCounts(): Promise<{ bekleyen: number; kullanici: number }> {
  const sb = requireSupabase();
  const [reports, users] = await Promise.all([
    sb.from("sikayetler").select("id", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("profiller").select("id", { count: "exact", head: true }),
  ]);
  return { bekleyen: reports.count ?? 0, kullanici: users.count ?? 0 };
}

// ---- Bakiye (027_cuzdan) ---------------------------------------------------
/** Kullanıcıya varlık ver/al (yönetici). miktar +/-. */
export async function grantBalance(userId: number, varlik: "elmas" | "altin", miktar: number, sebep?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("bakiye_ekle", { p_hedef: userId, p_varlik: varlik, p_miktar: miktar, p_sebep: sebep ?? null });
  if (error) throw error;
}

// ---- Mic yasağı (028_mic_yasak) --------------------------------------------
/** Platform mic-yasağı ver. dakika null → kalıcı. */
export async function micBan(userId: number, sebep: string | null, dakika: number | null): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_yasak_ver", { p_hedef: userId, p_sebep: sebep, p_dakika: dakika });
  if (error) throw error;
}
export async function micUnban(userId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("mic_yasak_kaldir", { p_hedef: userId });
  if (error) throw error;
}

// ---- Kullanıcı arama + detay (029_admin_kullanici) -------------------------
export async function searchUsers(query: string): Promise<PublicProfile[]> {
  return searchProfiles(query);
}

export type AdminUserDetail = {
  id: number;
  publicId: string;
  name: string;
  photo?: string;
  email: string | null; // yalnızca developer'a dolu gelir
  rol: "user" | "developer" | "super_admin";
  level: number;
  xp: number;
  elmas: number;
  altin: number;
  micBanned: boolean;
  micSebep: string | null;
  micBitis: number | null; // epoch ms | null(kalıcı ya da yasak yok)
  raporSayisi: number;
};

export async function getUserDetail(userId: number): Promise<AdminUserDetail | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("admin_kullanici_getir", { p_hedef: userId });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    id: r.id,
    publicId: r.public_id,
    name: r.kullanici_adi,
    photo: r.profil_resmi || undefined,
    email: r.email ?? null,
    rol: (r.rol as AdminUserDetail["rol"]) ?? "user",
    level: r.seviye_id ?? 1,
    xp: Number(r.deneyim_puani ?? 0),
    elmas: Number(r.elmas ?? 0),
    altin: Number(r.altin ?? 0),
    micBanned: !!r.mic_yasakli,
    micSebep: r.mic_sebep ?? null,
    micBitis: r.mic_bitis ? new Date(r.mic_bitis).getTime() : null,
    raporSayisi: Number(r.rapor_sayisi ?? 0),
  };
}

// ---- developer-özel: ID + şifre --------------------------------------------
export async function changePublicId(userId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_public_id_degistir", { p_hedef: userId, p_yeni: yeni.trim() });
  if (error) throw error;
}
export async function resetPassword(userId: number, yeni: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("admin_sifre_sifirla", { p_hedef: userId, p_yeni: yeni });
  if (error) throw error;
}
