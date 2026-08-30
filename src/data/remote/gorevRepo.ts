import { requireSupabase } from "@/lib/supabase";

/**
 * Görevler ve günlük giriş ödülü — 061_gorevler.sql.
 *
 * İlerleme istemciden GÖNDERİLMEZ: sunucu her okumada kaynak tablolardan
 * (oda ziyareti, mesaj, hediye, takip) sayar. Burada "görevi ilerlet" diye
 * bir çağrı olmamasının sebebi bu — olsaydı herkes kendi ilerlemesini
 * yazıp ödülü bedava alırdı.
 *
 * Ödüller ALTIN (promo kaynaklı): hediyeye harcanabilir, çekilemez.
 */

export type Gorev = {
  kod: string;
  ad: string;
  aciklama: string;
  hedef: number;
  ilerleme: number;
  odul: number;
  alindi: boolean;
  sira: number;
};

export type GirisGunu = {
  gun: number;
  miktar: number;
  alindi: boolean;
  bugun: boolean;
};

export type GirisDurumu = { gunler: GirisGunu[]; seri: number };

/** 061 uygulanmadıysa ekran boş görünür, çökmez. */
function yokSay(e: unknown) {
  const c = (e as { code?: string })?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

export async function gorevlerim(): Promise<Gorev[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("gorevlerim");
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    kod: String(r.kod ?? ""),
    ad: String(r.ad ?? ""),
    aciklama: String(r.aciklama ?? ""),
    hedef: Number(r.hedef ?? 1),
    ilerleme: Number(r.ilerleme ?? 0),
    odul: Number(r.odul ?? 0),
    alindi: Boolean(r.alindi),
    sira: Number(r.sira ?? 0),
  }));
}

/** Görev ödülünü al. Dönen: kazanılan ödül + yeni altın bakiyesi. */
export async function gorevOdulAl(kod: string): Promise<{ odul: number; altin: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("gorev_odul_al", { p_kod: kod });
  if (error) {
    if (yokSay(error)) throw new Error("Görev sistemi henüz açılmadı (061 çalıştırılmamış).");
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  return { odul: Number(r?.odul ?? 0), altin: Number(r?.altin ?? 0) };
}

export async function girisDurumu(): Promise<GirisDurumu> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("gunluk_giris_durum");
  if (error) {
    if (yokSay(error)) return { gunler: [], seri: 0 };
    throw error;
  }
  const satirlar = (data as Record<string, unknown>[]) ?? [];
  return {
    seri: Number(satirlar[0]?.seri ?? 0),
    gunler: satirlar.map((r) => ({
      gun: Number(r.gun_no ?? 0),
      miktar: Number(r.miktar ?? 0),
      alindi: Boolean(r.alindi),
      bugun: Boolean(r.bugun),
    })),
  };
}

/** Günlük giriş ödülünü al. */
export async function girisOdulAl(): Promise<{ gun: number; odul: number; altin: number; seri: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("gunluk_giris_al");
  if (error) {
    if (yokSay(error)) throw new Error("Görev sistemi henüz açılmadı (061 çalıştırılmamış).");
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  return {
    gun: Number(r?.gun_no ?? 0),
    odul: Number(r?.odul ?? 0),
    altin: Number(r?.altin ?? 0),
    seri: Number(r?.seri ?? 0),
  };
}
