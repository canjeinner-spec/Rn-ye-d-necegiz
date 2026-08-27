import { requireSupabase } from "@/lib/supabase";

/**
 * Rozet sistemi (049_rozet_sistemi).
 *
 * Katalog `rozetler`, kazanılanlar `kullanici_rozetleri` tablosunda.
 * `kod` alanı uygulamadaki PNG anahtarıyla birebir aynı (örn. "night_owl",
 * "level_gold", "role_developer") — bileşenler doğrudan bu kodu kullanır.
 */

/** Kazanılmış rozet. */
export type KazanilmisRozet = {
  kod: string;
  ad: string;
  aciklama: string | null;
  kategori: string | null;
  kazanma_tarihi: string;
};

/** Katalog + ilerleme (kazanılmamışlar için "kaç/kaç"). */
export type RozetIlerleme = {
  kod: string;
  ad: string;
  aciklama: string | null;
  kategori: string | null;
  kazanildi: boolean;
  kural_metrik: string | null;
  kural_esik: number | null;
  ilerleme: number;
};

/**
 * Kuralı tutan rozetleri otomatik verir, yeni verilen sayısını döndürür.
 * Uygulama açılışında (profil yüklenince) çağrılır — ucuz ve idempotent.
 */
export async function evaluateBadges(): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("rozetleri_degerlendir");
  if (error) throw error;
  return Number(data ?? 0);
}

/** Bir kullanıcının kazandığı rozetler (gösterim sırasına göre). */
export async function getUserBadges(userId: number): Promise<KazanilmisRozet[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("kullanici_rozetleri_getir", { p_kullanici: userId });
  if (error) throw error;
  return (data as KazanilmisRozet[]) ?? [];
}

/** Kendi rozet ilerlemem — kazanılan + kazanılmayan, hedefleriyle. */
export async function getMyBadgeProgress(): Promise<RozetIlerleme[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("rozet_ilerlemem");
  if (error) throw error;
  return (data as RozetIlerleme[]) ?? [];
}

/**
 * Kazanılmış bir rozeti kuşan — profilde (kendi ve başkalarının gördüğü)
 * görünür. Sunucu sahipliği doğrular; kazanılmamış rozet kuşanılamaz.
 */
export async function equipBadge(kod: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("rozet_kusan", { p_kod: kod });
  if (error) throw error;
}

/** Kuşanılan rozeti çıkar. */
export async function unequipBadge(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("rozet_kusanma_kaldir");
  if (error) throw error;
}

/** Yönetici: elle rozet ver (kuralı olmayan rozetler için). */
export async function adminGrantBadge(userId: number, kod: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("rozet_ver", { p_hedef: userId, p_kod: kod });
  if (error) throw error;
}

/** Yönetici: rozeti geri al. */
export async function adminRevokeBadge(userId: number, kod: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("rozet_al", { p_hedef: userId, p_kod: kod });
  if (error) throw error;
}
