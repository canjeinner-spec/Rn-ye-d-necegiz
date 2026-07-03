import { requireSupabase } from "@/lib/supabase";

// ── Banner'lar (duyuru_bannerlari) ─────────────────────────────────────────
/** Banner'a dokununca açılan premium tam-sayfa şablonu. */
export type BannerSablon = "duyuru" | "bakim" | "etkinlik";
/** Şablon sayfasındaki düzenlenebilir metinler. */
export type BannerMadde = { baslik: string; aciklama?: string };
export type BannerIcerik = {
  altBaslik?: string;
  rozet?: string;
  giris?: string;
  maddeler?: BannerMadde[];
  kapanis?: string;
};
export type Banner = { id: number; baslik: string; aciklama?: string; foto?: string; sira: number; sablon: BannerSablon; icerik: BannerIcerik };

type BannerRow = { id: number; baslik: string; aciklama: string | null; foto_url: string | null; sira: number; sablon: string | null; icerik: BannerIcerik | null };
function mapBanner(r: BannerRow): Banner {
  return {
    id: r.id, baslik: r.baslik, aciklama: r.aciklama || undefined, foto: r.foto_url || undefined, sira: r.sira,
    sablon: (r.sablon as BannerSablon) || "duyuru", icerik: r.icerik ?? {},
  };
}
const BANNER_COLS = "id, baslik, aciklama, foto_url, sira, sablon, icerik";

/** Aktif banner'lar (sıraya göre). */
export async function listBanners(): Promise<Banner[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("duyuru_bannerlari")
    .select(BANNER_COLS)
    .eq("aktif", true)
    .order("sira", { ascending: true })
    .order("id", { ascending: false });
  if (error) throw error;
  return ((data as BannerRow[]) ?? []).map(mapBanner);
}

/** Tek banner (düzenleme/detay sayfası için). */
export async function getBanner(id: number): Promise<Banner | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from("duyuru_bannerlari").select(BANNER_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapBanner(data as BannerRow) : null;
}

export async function createBanner(baslik: string, aciklama?: string, foto?: string, sira = 0, sablon: BannerSablon = "duyuru", icerik: BannerIcerik = {}): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("banner_ekle", { p_baslik: baslik.trim(), p_aciklama: aciklama ?? null, p_foto: foto ?? null, p_sira: sira, p_sablon: sablon, p_icerik: icerik });
  if (error) throw error;
  return data as number;
}
export async function updateBanner(id: number, baslik: string, aciklama: string | null, foto: string | null, sira: number, sablon?: BannerSablon, icerik?: BannerIcerik): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("banner_guncelle", { p_id: id, p_baslik: baslik, p_aciklama: aciklama, p_foto: foto, p_sira: sira, p_sablon: sablon ?? null, p_icerik: icerik ?? null });
  if (error) throw error;
}
export async function deleteBanner(id: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("banner_sil", { p_id: id });
  if (error) throw error;
}

// ── Sistem duyuruları (DM resmi/sistem thread + herkese gönderim) ───────────
export type AnnounceKanal = "aron" | "sistem";
export type Announcement = { id: number; kanal: AnnounceKanal; baslik: string; icerik: string; foto?: string; at: number };

/** Bir kanaldaki duyurular (yeniden eskiye). DM resmi/sistem sohbeti buradan okur. */
export async function listAnnouncements(kanal: AnnounceKanal, limit = 50): Promise<Announcement[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("sistem_duyurulari")
    .select("id, kanal, baslik, icerik, foto_url, olusturma")
    .eq("kanal", kanal)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as { id: number; kanal: AnnounceKanal; baslik: string; icerik: string; foto_url: string | null; olusturma: string }[]) ?? []).map((r) => ({
    id: r.id, kanal: r.kanal, baslik: r.baslik, icerik: r.icerik, foto: r.foto_url || undefined, at: new Date(r.olusturma).getTime(),
  }));
}

/** Herkese duyuru gönder (yönetici). bildirim=true → bildirim çanına da fan-out. */
export async function sendAnnouncement(kanal: AnnounceKanal, baslik: string, icerik: string, foto?: string, bildirim = true): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("sistem_duyuru_gonder", {
    p_kanal: kanal, p_baslik: baslik.trim(), p_icerik: icerik.trim(), p_foto: foto ?? null, p_bildirim: bildirim,
  });
  if (error) throw error;
  return data as number;
}
