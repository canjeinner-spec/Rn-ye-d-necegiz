import { type BildirimItem, type BildirimKategori } from "@/data/notifications";
import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

type BildirimRow = {
  id: number;
  tip: string;
  baslik: string | null;
  icerik: string | null;
  veri: Record<string, unknown> | null;
  okundu: boolean;
  olusturulma_tarihi: string;
};

const STYLE: Record<string, { kategori: BildirimKategori; ikon: string; renk: string }> = {
  begeni: { kategori: "sosyal", ikon: "❤️", renk: "#FB7185" },
  yorum: { kategori: "sosyal", ikon: "💬", renk: "#60A5FA" },
  dm: { kategori: "sosyal", ikon: "✉️", renk: "#A855F7" },
  takip: { kategori: "sosyal", ikon: "💜", renk: "#A855F7" },
  hediye: { kategori: "sistem", ikon: "🎁", renk: "#34D399" },
  oda_davet: { kategori: "etkinlik", ikon: "🚪", renk: "#F5CE6E" },
  odeme: { kategori: "sistem", ikon: "💎", renk: "#22D3EE" },
  sistem: { kategori: "sistem", ikon: "🔔", renk: "#22D3EE" },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Dün" : `${d} gün önce`;
}

export function mapNotif(r: BildirimRow): BildirimItem {
  const s = STYLE[r.tip] || STYLE.sistem;
  return {
    id: r.id,
    kategori: s.kategori,
    tip: r.tip,
    ikon: s.ikon,
    renk: s.renk,
    baslik: r.baslik || "Bildirim",
    icerik: r.icerik || "",
    zaman: timeAgo(r.olusturulma_tarihi),
    okunmadi: !r.okundu,
  };
}

const COLS = "id, tip, baslik, icerik, veri, okundu, olusturulma_tarihi";

/** Kendi bildirimlerim (yeniden eskiye). */
export async function listNotifications(limit = 60): Promise<BildirimItem[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("bildirimler").select(COLS).order("olusturulma_tarihi", { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data as BildirimRow[]) ?? []).map(mapNotif);
}

/** Okunmamış bildirim sayısı. */
export async function getUnreadCount(): Promise<number> {
  const sb = requireSupabase();
  const { count, error } = await sb.from("bildirimler").select("id", { count: "exact", head: true }).eq("okundu", false);
  if (error) throw error;
  return count ?? 0;
}

/** Hepsini okundu işaretle. */
export async function markAllNotifsRead(): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return;
  await sb.from("bildirimler").update({ okundu: true }).eq("kullanici_id", me.id).eq("okundu", false);
}

/** Tek bildirimi okundu işaretle. */
export async function markNotifRead(id: number): Promise<void> {
  const sb = requireSupabase();
  await sb.from("bildirimler").update({ okundu: true }).eq("id", id);
}
