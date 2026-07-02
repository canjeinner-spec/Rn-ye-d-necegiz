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
