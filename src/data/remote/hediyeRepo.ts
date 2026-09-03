import { requireSupabase } from "@/lib/supabase";

/**
 * Hediye ekonomisi — TEMEL şema (059_hediye_temel_semaya_gecis.sql).
 *
 * 058'de kendi tablolarımızı kurmuştuk; sonra temel şemada zaten eksiksiz bir
 * ekonomi olduğu ortaya çıktı: `hediyeler` + `hediye_gecmisi` ve iki trigger
 * (fiyat, komisyon, idempotency, yaptırım, günlük limit, lot muhasebesi, XP,
 * oda istatistiği, platform havuzu). Artık oraya bağlıyız; 058'in tabloları
 * kullanılmıyor.
 *
 * Önemli: hediye ALTIN ile gönderilir. Elmas satın alınan varlıktır ve
 * `elmas_altin_donustur` ile altına çevrilir. Kazanç `kazanc_puani`nda birikir.
 */

export type Kademe = "normal" | "rare" | "epic" | "legendary";

/** Katalogdaki hediye — istemci `Gift` tipiyle uyumlu alanlar üretilir. */
export type KatalogHediyesi = {
  /** hediye_gecmisi.hediye_id — gönderimde bu kullanılır */
  dbId: number;
  /** istemcideki sabit kod ("rose") — görsel eşlemesi için */
  kod: string;
  ad: string;
  kategori: string;
  emoji: string;
  fiyat: number;
  renk1: string;
  renk2: string;
  kademe: Kademe;
  sira: number;
};

export type GonderimSonucu = {
  kayitId: number;
  toplam: number;
  kazanc: number;
  komisyon: number;
  /** gönderim sonrası altın bakiyesi */
  altin: number;
};

export type Bakiyem = {
  altin: number;
  toplam: number;
  promo: number;
  cekilebilir: number;
  kazanc: number;
};

export type KazancOzeti = {
  bugun: number;
  buAy: number;
  toplam: number;
  komisyon: number;
  hediyeAy: number;
  kisiAy: number;
};

export type SaatDilimi = { saat: number; altin: number; hediye: number };
export type GunDilimi = { gun: string; altin: number; hediye: number };

export type GelenHediye = {
  id: number;
  gonderen: string;
  gonderenPid: string | null;
  hediyeAd: string;
  emoji: string;
  adet: number;
  kazanc: number;
  tarih: number;
};

/** 059 uygulanmadıysa ekranlar çökmesin. */
function yokSay(e: unknown) {
  const c = (e as { code?: string })?.code;
  return c === "42P01" || c === "42883" || c === "PGRST202" || c === "PGRST205";
}

/** Mağaza/hediye kutusu kataloğu — temel `hediyeler` tablosundan. */
export async function katalog(): Promise<KatalogHediyesi[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("hediyeler")
    .select("id, kod, ad, kategori, birim_fiyat, emoji, renk1, renk2, kademe, sira")
    .eq("aktif", true)
    .order("sira", { ascending: true });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as Record<string, unknown>[]) ?? [])
    .filter((r) => r.kod) // kodu olmayan (operatörün kendi) satırları istemci çizemez
    .map((r) => ({
      dbId: Number(r.id),
      kod: String(r.kod),
      ad: String(r.ad ?? ""),
      kategori: String(r.kategori ?? "Hediye"),
      emoji: String(r.emoji ?? "🎁"),
      fiyat: Number(r.birim_fiyat ?? 0),
      renk1: String(r.renk1 ?? "#FDE68A"),
      renk2: String(r.renk2 ?? "#B45309"),
      kademe: (String(r.kademe ?? "normal") as Kademe),
      sira: Number(r.sira ?? 0),
    }));
}

/**
 * Hediye gönder. Bütün doğrulama ve muhasebe DB trigger'ında:
 * fiyat katalogdan, komisyon ayarlardan, altın `lot_harca` ile düşer,
 * alıcının kazancı `kazanc_hareket` ile yazılır.
 */
export async function hediyeGonder(
  hediyeDbId: number,
  adet: number,
  aliciId: number,
  odaId?: number | null,
): Promise<GonderimSonucu> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("hediye_gonder_v2", {
    p_hediye_id: hediyeDbId,
    p_miktar: adet,
    p_alici_id: aliciId,
    p_oda_id: odaId ?? null,
  });
  if (error) {
    if (yokSay(error)) throw new Error("Hediye sistemi henüz açılmadı (059 çalıştırılmamış).");
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  return {
    kayitId: Number(r?.kayit_id ?? 0),
    toplam: Number(r?.toplam ?? 0),
    kazanc: Number(r?.kazanc ?? 0),
    komisyon: Number(r?.komisyon ?? 0),
    altin: Number(r?.altin ?? 0),
  };
}

/**
 * "Herkese" hediye — odadaki HERKESE tek işlemde (081).
 *
 * Eskiden bu seçenek sunucuya HİÇ gelmiyordu: alıcı uid'i üretilmediği için
 * `room.tsx` RPC'yi atlıyor, yalnız animasyon oynuyordu. Yani varsayılan
 * seçenekle gönderilen her hediye bedavaydı.
 *
 * Ücret alıcı BAŞINA; altın yetmezse sunucu tamamını geri alır.
 */
export async function hediyeGonderHerkese(
  hediyeDbId: number,
  adet: number,
  odaId: number,
): Promise<{ aliciSayisi: number; toplam: number; altin: number }> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("hediye_gonder_herkese", {
    p_hediye_id: hediyeDbId,
    p_miktar: adet,
    p_oda_id: odaId,
  });
  if (error) {
    if (yokSay(error)) throw new Error("Herkese gönderim henüz açılmadı (081 çalıştırılmamış).");
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  return {
    aliciSayisi: Number(r?.alici_sayisi ?? 0),
    toplam: Number(r?.toplam ?? 0),
    altin: Number(r?.altin ?? 0),
  };
}

/** Gerçek bakiyelerim (kullanicilar üzerindeki cache kolonları). */
export async function bakiyem(): Promise<Bakiyem | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("benim_bakiyem_v2");
  if (error) {
    if (yokSay(error)) return null;
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  if (!r) return null;
  return {
    altin: Number(r.altin ?? 0),
    toplam: Number(r.toplam ?? 0),
    promo: Number(r.promo ?? 0),
    cekilebilir: Number(r.cekilebilir ?? 0),
    kazanc: Number(r.kazanc ?? 0),
  };
}

/** Platform komisyon oranı (0-1). */
export async function komisyonOrani(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("hediye_komisyon");
  if (error) return 0.3;
  const n = Number(Array.isArray(data) ? data[0] : data);
  return Number.isFinite(n) && n > 0 ? n : 0.3;
}

export async function kazancOzeti(): Promise<KazancOzeti | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("kazanc_ozeti_v2");
  if (error) {
    if (yokSay(error)) return null;
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | undefined;
  if (!r) return null;
  return {
    bugun: Number(r.bugun ?? 0),
    buAy: Number(r.bu_ay ?? 0),
    toplam: Number(r.toplam ?? 0),
    komisyon: Number(r.komisyon ?? 0),
    hediyeAy: Number(r.hediye_ay ?? 0),
    kisiAy: Number(r.kisi_ay ?? 0),
  };
}

export async function kazancSaatlik(gunOnce = 0): Promise<SaatDilimi[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("kazanc_saatlik_v2", { p_gun_once: gunOnce });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as { saat: number; altin: number; hediye: number }[]) ?? []).map((r) => ({
    saat: Number(r.saat),
    altin: Number(r.altin ?? 0),
    hediye: Number(r.hediye ?? 0),
  }));
}

export async function kazancGunluk(gun = 7): Promise<GunDilimi[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("kazanc_gunluk_v2", { p_gun: gun });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as { gun: string; altin: number; hediye: number }[]) ?? []).map((r) => ({
    gun: r.gun,
    altin: Number(r.altin ?? 0),
    hediye: Number(r.hediye ?? 0),
  }));
}

export async function sonHediyelerim(limit = 20): Promise<GelenHediye[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("son_hediyelerim_v2", { p_limit: limit });
  if (error) {
    if (yokSay(error)) return [];
    throw error;
  }
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: Number(r.id),
    gonderen: String(r.gonderen ?? "Sistem"),
    gonderenPid: (r.gonderen_pid as string) ?? null,
    hediyeAd: String(r.hediye_ad ?? ""),
    emoji: String(r.emoji ?? "🎁"),
    adet: Number(r.adet ?? 1),
    kazanc: Number(r.kazanc ?? 0),
    tarih: Date.parse(String(r.tarih)) || 0,
  }));
}
