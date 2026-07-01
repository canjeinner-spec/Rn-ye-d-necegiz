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
    sb.from("raporlar").select("id", { count: "exact", head: true }).eq("durum", "bekliyor"),
    sb.from("profiller").select("id", { count: "exact", head: true }),
  ]);
  return { bekleyen: reports.count ?? 0, kullanici: users.count ?? 0 };
}
