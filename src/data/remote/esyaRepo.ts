import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

/**
 * Eşya sistemi (056_esya_sistemi.sql) — mağaza kataloğu, envanter, kuşanma.
 *
 * Mağaza ve Eşyalarım sahteydi: katalog data/store.ts sabiti, bakiye ekranda
 * yazan 12.400, "Satın Al" yerel bir Set. Artık üçü de DB'de.
 *
 * 056 çalıştırılmamışsa hiçbir ekran çökmez: liste boş döner, satın alma
 * anlaşılır bir hata verir.
 */

export type EsyaTip = "cerceve" | "giris" | "balon";
export type Nadirlik = "standart" | "nadir" | "epik" | "efsane";

export type Esya = {
  id: string;
  tip: EsyaTip;
  ad: string;
  aciklama: string | null;
  tema: string;
  nadirlik: Nadirlik;
  fiyatAltin: number;
  /** null = süresiz */
  sureGun: number | null;
  sira: number;
};

/** Envanterdeki eşya — katalog bilgisi + bende ne durumda. */
export type SahipEsya = Esya & {
  /** epoch ms · null = süresiz */
  bitis: number | null;
  kusanildi: boolean;
};

/** Tip başına kuşanılan TEMA anahtarı (görseli bu belirler). */
export type Kusanili = { cerceve: string | null; giris: string | null; balon: string | null };

export const BOS_KUSANILI: Kusanili = { cerceve: null, giris: null, balon: null };

type EsyaRow = {
  id: string;
  tip: EsyaTip;
  ad: string;
  aciklama: string | null;
  tema: string;
  nadirlik: Nadirlik;
  fiyat_altin: number;
  sure_gun: number | null;
  sira: number;
};

/** 056 uygulanmadıysa (tablo/fonksiyon yok) sessizce boş dön. */
function tabloYok(e: unknown) {
  const c = (e as { code?: string })?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

function mapEsya(r: EsyaRow): Esya {
  return {
    id: r.id,
    tip: r.tip,
    ad: r.ad,
    aciklama: r.aciklama,
    tema: r.tema,
    nadirlik: r.nadirlik,
    fiyatAltin: Number(r.fiyat_altin ?? 0),
    sureGun: r.sure_gun,
    sira: r.sira,
  };
}

const SUTUNLAR = "id, tip, ad, aciklama, tema, nadirlik, fiyat_altin, sure_gun, sira";

/** Mağaza kataloğu (aktif eşyalar, tipe ve sıraya göre). */
export async function katalog(): Promise<Esya[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("esyalar")
    .select(SUTUNLAR)
    .order("tip", { ascending: true })
    .order("sira", { ascending: true });
  if (error) {
    if (tabloYok(error)) return [];
    throw error;
  }
  return ((data as EsyaRow[]) ?? []).map(mapEsya);
}

/** Envanterim — süresi dolmuşlar da döner (ekranda "süresi doldu" görünür). */
export async function esyalarim(): Promise<SahipEsya[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb
    .from("kullanici_esyalari")
    .select(`esya_id, bitis, kusanildi, esyalar (${SUTUNLAR})`)
    .eq("kullanici_id", me.id);
  if (error) {
    if (tabloYok(error)) return [];
    throw error;
  }
  const satirlar = (data as unknown as { bitis: string | null; kusanildi: boolean; esyalar: EsyaRow | null }[]) ?? [];
  return satirlar
    .filter((r) => !!r.esyalar)
    .map((r) => ({
      ...mapEsya(r.esyalar as EsyaRow),
      bitis: r.bitis ? Date.parse(r.bitis) : null,
      kusanildi: !!r.kusanildi,
    }))
    .sort((a, b) => a.tip.localeCompare(b.tip) || a.sira - b.sira);
}

/** Satın al — altın atomik düşer. Dönen değer yeni bakiye. */
export async function satinAl(esyaId: string): Promise<{ elmas: number; altin: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("esya_satin_al", { p_esya_id: esyaId });
  if (error) {
    if (tabloYok(error)) throw new Error("Mağaza henüz açılmadı (056 çalıştırılmamış).");
    throw error;
  }
  const satir = (Array.isArray(data) ? data[0] : data) as { elmas: number; altin: number } | undefined;
  return { elmas: Number(satir?.elmas ?? 0), altin: Number(satir?.altin ?? 0) };
}

/** Kuşan — aynı tipteki diğer eşya otomatik çıkar. */
export async function kusan(esyaId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("esya_kusan", { p_esya_id: esyaId });
  if (error) throw error;
}

export async function cikar(esyaId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("esya_cikar", { p_esya_id: esyaId });
  if (error) throw error;
}

/** Kendi kuşandıklarım (tema anahtarları). */
export async function benimKusanilanlarim(): Promise<Kusanili> {
  const me = await getMyProfile().catch(() => null);
  if (!me) return { ...BOS_KUSANILI };
  const harita = await kusanilanlariGetir([me.id]);
  return harita.get(me.id) ?? { ...BOS_KUSANILI };
}

/**
 * Birden çok kullanıcının kuşandıkları — odada/profilde başkasının
 * çerçevesini çizmek için. `kusanili_esyalar` görünümü herkese açık.
 */
export async function kusanilanlariGetir(ids: number[]): Promise<Map<number, Kusanili>> {
  const harita = new Map<number, Kusanili>();
  const uniq = [...new Set(ids.filter((x) => x != null))];
  if (uniq.length === 0) return harita;

  const sb = requireSupabase();
  const { data, error } = await sb
    .from("kusanili_esyalar")
    .select("kullanici_id, tip, tema")
    .in("kullanici_id", uniq);
  if (error) {
    if (tabloYok(error)) return harita;
    throw error;
  }

  for (const r of (data as { kullanici_id: number; tip: EsyaTip; tema: string }[]) ?? []) {
    const mevcut = harita.get(r.kullanici_id) ?? { ...BOS_KUSANILI };
    mevcut[r.tip] = r.tema;
    harita.set(r.kullanici_id, mevcut);
  }
  return harita;
}
