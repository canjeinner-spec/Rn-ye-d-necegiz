import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * XP kazan (026_xp.sql → xp_ekle RPC). Günlük tavanlar sunucuda:
 *   gunluk_giris +20 (günde 1) · oda_katilim +10 (günde 1) · oda_mesaj +2 (≤40/gün)
 * Dönen değer: bu çağrıda gerçekten kazanılan puan (0 = tavan dolu/hata).
 * Hatalar sessizce yutulur — XP hiçbir akışı bloklamamalı.
 */
export async function addXp(kaynak: "gunluk_giris" | "oda_katilim" | "oda_mesaj"): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc("xp_ekle", { p_kaynak: kaynak });
    if (error) return 0;
    return typeof data === "number" ? data : 0;
  } catch {
    return 0;
  }
}

export type LevelInfo = {
  level: number;
  xp: number;
  /** Bir sonraki seviyenin eşiği (yoksa/max: null) */
  nextAt: number | null;
  /** Mevcut seviyenin başladığı eşik (progress hesabı için) */
  currentAt: number;
};

/** Gerçek seviye/XP + sonraki eşik. seviyeler okunamazsa formül fallback. */
export async function getLevelInfo(): Promise<LevelInfo | null> {
  if (!isSupabaseConfigured) return null;
  const me = await getMyProfile().catch(() => null);
  if (!me) return null;
  const xp = me.deneyim_puani ?? 0;
  const level = me.seviye_id ?? 1;

  try {
    const sb = requireSupabase();
    const { data } = await sb
      .from("seviyeler")
      .select("id, minimum_deneyim_puani")
      .order("minimum_deneyim_puani", { ascending: true });
    const rows = (data as { id: number; minimum_deneyim_puani: number }[]) ?? [];
    if (rows.length) {
      const current = [...rows].reverse().find((r) => r.minimum_deneyim_puani <= xp);
      const next = rows.find((r) => r.minimum_deneyim_puani > xp);
      return { level, xp, nextAt: next?.minimum_deneyim_puani ?? null, currentAt: current?.minimum_deneyim_puani ?? 0 };
    }
  } catch {
    // tablo okunamıyorsa formüle düş
  }
  // Fallback eğri: LV n eşiği = 100·(n−1)²
  const currentAt = 100 * (level - 1) * (level - 1);
  const nextAt = 100 * level * level;
  return { level, xp, nextAt, currentAt };
}
