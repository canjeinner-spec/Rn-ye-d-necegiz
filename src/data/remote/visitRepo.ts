import { type Visitor } from "@/data/visitors";
import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? `Dün ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : `${dd} gün önce`;
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Profil ziyaretini kaydet (her ziyaretçiden tek satır; kendini saymaz). */
export async function recordVisit(visitedUserId: number): Promise<void> {
  const sb = requireSupabase();
  await sb.rpc("ziyaret_kaydet", { p_edilen: visitedUserId });
}

/** Bir kullanıcının ziyaretçi sayısı (herkese açık). */
export async function getVisitorCount(userId: number): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("ziyaret_sayisi", { p_kullanici: userId });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Beni ziyaret edenler (yeniden eskiye) + profilleri. */
export async function getMyVisitors(limit = 100): Promise<Visitor[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb
    .from("profil_ziyaretleri")
    .select("ziyaret_eden_id, ziyaret_tarihi")
    .eq("ziyaret_edilen_id", me.id)
    .order("ziyaret_tarihi", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as { ziyaret_eden_id: number; ziyaret_tarihi: string }[]) ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.ziyaret_eden_id))];
  const { data: profs } = await sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi, seviye_id, cinsiyet").in("id", ids);
  const map = new Map<number, { public_id: string; kullanici_adi: string; profil_resmi: string | null; seviye_id: number | null; cinsiyet: string | null }>();
  for (const p of (profs as never[]) ?? []) map.set((p as { id: number }).id, p as never);

  return rows.map((r) => {
    const p = map.get(r.ziyaret_eden_id);
    return {
      name: p?.kullanici_adi || "Kullanıcı",
      lv: p?.seviye_id ?? 1,
      when: timeAgo(r.ziyaret_tarihi),
      today: isToday(r.ziyaret_tarihi),
      vip: false,
      gender: (p?.cinsiyet === "k" ? "k" : "e") as "e" | "k",
      photo: p?.profil_resmi || undefined,
      publicId: p?.public_id,
    };
  });
}
