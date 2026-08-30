import { requireSupabase } from "@/lib/supabase";

/**
 * Sıralama — 060_siralama.sql.
 *
 * Kaynak `hediye_gecmisi`; okuma anında hesaplanıyor (temel şemadaki
 * `leaderboards` anlık görüntü tablolarını dolduracak bir zamanlayıcı yok).
 * Dönem sınırları sunucuda Europe/Istanbul'a göre kesiliyor, bu yüzden
 * "kaç gün kaldı" da sunucudan soruluyor — cihaz saat dilimine göre
 * hesaplasak liste ile sayaç farklı haftaları gösterebilirdi.
 */

export type Periyot = "gun" | "hafta" | "ay" | "tum";

export const PERIYOTLAR: { kod: Periyot; ad: string }[] = [
  { kod: "gun", ad: "Bugün" },
  { kod: "hafta", ad: "Hafta" },
  { kod: "ay", ad: "Ay" },
  { kod: "tum", ad: "Tüm zaman" },
];

export type SiraKisi = {
  sira: number;
  uid: number;
  publicId: string;
  ad: string;
  foto?: string;
  rozet?: string;
  puan: number;
};

export type SiraOda = {
  sira: number;
  odaId: number;
  publicId: string;
  ad: string;
  kapak?: string;
  sahip: string;
  online: number;
  puan: number;
};

/** 060 uygulanmadıysa ekran boş durum gösterir, çökmez. */
function yokSay(e: unknown) {
  const c = (e as { code?: string })?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

function kisiler(data: unknown): SiraKisi[] {
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    sira: Number(r.sira ?? 0),
    uid: Number(r.kullanici_id ?? 0),
    publicId: String(r.public_id ?? ""),
    ad: String(r.ad ?? ""),
    foto: (r.foto as string) || undefined,
    rozet: (r.rozet as string) || undefined,
    puan: Number(r.puan ?? 0),
  }));
}

async function kisiSiralamasi(rpc: string, periyot: Periyot, limit: number): Promise<SiraKisi[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc(rpc, { p_periyot: periyot, p_limit: limit });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return kisiler(data);
}

/** En çok hediye gönderenler (harcanan altın). */
export function zenginlik(periyot: Periyot = "hafta", limit = 50) {
  return kisiSiralamasi("siralama_zenginlik", periyot, limit);
}

/** En çok hediye alanlar (kazanılan altın — komisyon düşülmüş). */
export function cazibe(periyot: Periyot = "hafta", limit = 50) {
  return kisiSiralamasi("siralama_cazibe", periyot, limit);
}

/** Dönem içinde en çok hediye dönen odalar. */
export async function odalar(periyot: Periyot = "hafta", limit = 50): Promise<SiraOda[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("siralama_odalar", { p_periyot: periyot, p_limit: limit });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    sira: Number(r.sira ?? 0),
    odaId: Number(r.oda_id ?? 0),
    publicId: String(r.public_id ?? ""),
    ad: String(r.ad ?? ""),
    kapak: (r.kapak as string) || undefined,
    sahip: String(r.sahip ?? ""),
    online: Number(r.online ?? 0),
    puan: Number(r.puan ?? 0),
  }));
}

/** Dönemin bitişi (epoch ms). "Tüm zaman" için null. */
export async function donemBitis(periyot: Periyot = "hafta"): Promise<number | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("siralama_donem_bitis", { p_periyot: periyot });
  if (error) return null;
  const t = Date.parse(String(Array.isArray(data) ? data[0] : data));
  return Number.isFinite(t) ? t : null;
}

/** "2g 14sa" — sıfırın altına düşerse null (dönem dönmüş, liste yenilenecek). */
export function kalanSure(bitis: number | null): string | null {
  if (bitis == null) return null;
  const ms = bitis - Date.now();
  if (ms <= 0) return null;
  const dk = Math.floor(ms / 60000);
  const gun = Math.floor(dk / 1440);
  const saat = Math.floor((dk % 1440) / 60);
  if (gun > 0) return `${gun}g ${saat}sa kaldı`;
  if (saat > 0) return `${saat}sa ${dk % 60}dk kaldı`;
  return `${dk}dk kaldı`;
}
