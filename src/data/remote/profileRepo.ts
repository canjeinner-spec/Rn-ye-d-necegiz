import { requireSupabase } from "@/lib/supabase";

/** Kendi profilimde okunabilen/güncellenebilen güvenli alanlar. */
export type Profile = {
  id: number;
  public_id: string;
  kullanici_adi: string;
  email: string | null;
  profil_resmi: string | null;
  biyografi: string | null;
  cinsiyet: string | null;
  ulke: string | null;
  sehir: string | null;
  seviye_id: number | null;
  deneyim_puani: number;
  durum: string;
  ekonomi_rolu: string;
  ozel_id: string | null;
  ozel_id_tip: "premium" | "kapsul" | null;
  ozel_id_tema: string | null;
  beta_tester: boolean;
  premium_hak: boolean;
};

const SELF_COLS =
  "id, public_id, kullanici_adi, email, profil_resmi, biyografi, cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum, ekonomi_rolu, ozel_id, ozel_id_tip, ozel_id_tema, beta_tester, premium_hak";

/**
 * Aktif oturumun auth uid'sini YEREL olarak döndürür — AĞ round-trip'i YOK.
 * `sb.auth.getUser()` her çağrıda `/auth/v1/user`'a gidip token doğrular
 * (gecikmenin ana kaynağıydı; getMyProfile 43 yerde çağrılıyor); `getSession()`
 * saklı oturumdan okur, anında döner.
 */
async function currentAuthUid(): Promise<string | null> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Kısa-TTL bellek memo'su: aynı auth uid için art arda gelen getMyProfile
// çağrılarını (ekran mount patlaması + birçok repo'nun `me.id` ihtiyacı)
// tek sorguya indirir. Mutasyonda invalidate edilir.
let _profileMemo: { uid: string; at: number; value: Profile | null } | null = null;
const PROFILE_TTL = 2000;
function invalidateProfileMemo() { _profileMemo = null; }

/** Giriş yapan kullanıcının kendi profili (kullanicilar, RLS: kendi satırı). */
export async function getMyProfile(): Promise<Profile | null> {
  const sb = requireSupabase();
  const uid = await currentAuthUid();
  if (!uid) return null;
  if (_profileMemo && _profileMemo.uid === uid && Date.now() - _profileMemo.at < PROFILE_TTL) {
    return _profileMemo.value;
  }
  const { data, error } = await sb
    .from("kullanicilar")
    .select(SELF_COLS)
    .eq("auth_uid", uid)
    .maybeSingle();
  if (error) throw error;
  const value = (data as Profile | null) ?? null;
  _profileMemo = { uid, at: Date.now(), value };
  return value;
}

/** Kendi profilini güncelle (yalnızca izinli kolonlar; RLS + kolon-yetkisi korur). */
export async function updateMyProfile(
  patch: Partial<Pick<Profile, "kullanici_adi" | "profil_resmi" | "biyografi" | "cinsiyet" | "ulke" | "sehir">>,
): Promise<Profile> {
  const sb = requireSupabase();
  const uid = await currentAuthUid();
  if (!uid) throw new Error("Oturum yok.");
  const { data, error } = await sb
    .from("kullanicilar")
    .update(patch)
    .eq("auth_uid", uid)
    .select(SELF_COLS)
    .single();
  if (error) throw error;
  invalidateProfileMemo(); // güncel profil bir sonraki okumada taze gelsin
  return data as Profile;
}

/** Profil satırı yoksa (auth.uid() için) yeniden oluşturur — self-heal. */
export async function ensureMyProfile(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("profilimi_garantile");
  if (error) throw error;
  invalidateProfileMemo(); // yeni oluşan satır bir sonraki okumada görünsün
}

/** Görünen ad (kullanici_adi) müsait mi? (case-insensitive, RPC). */
export async function isUsernameAvailable(name: string): Promise<boolean> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("kullanici_adi_musait", { p_ad: name });
  if (error) throw error;
  return Boolean(data);
}

/** Herkese açık profil (profiller view — hassas kolonlar gizli). */
export type PublicProfile = {
  id: number;
  public_id: string;
  kullanici_adi: string;
  profil_resmi: string | null;
  biyografi: string | null;
  cinsiyet: string | null;
  ulke: string | null;
  sehir: string | null;
  seviye_id: number | null;
  deneyim_puani: number;
  durum: string;
  ekonomi_rolu: string;
  ozel_id: string | null;
  ozel_id_tip: "premium" | "kapsul" | null;
  ozel_id_tema: string | null;
};

const PUBLIC_COLS =
  "id, public_id, kullanici_adi, profil_resmi, biyografi, cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum, ekonomi_rolu, ozel_id, ozel_id_tip, ozel_id_tema";

/** Başka bir kullanıcının herkese açık profili (profiller view). */
export async function getPublicProfile(publicId: string): Promise<PublicProfile | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("profiller")
    .select(PUBLIC_COLS)
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data as PublicProfile | null;
}

/** Kullanıcı arama — görünen ad, public_id VEYA özel ID ile (case-insensitive). */
export async function searchProfiles(query: string, limit = 20): Promise<PublicProfile[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sb = requireSupabase();
  const safe = q.replace(/[%,]/g, ""); // PostgREST or-filtresini bozacak karakterleri çıkar
  const { data, error } = await sb
    .from("profiller")
    .select(PUBLIC_COLS)
    .or(`kullanici_adi.ilike.%${safe}%,public_id.ilike.%${safe}%,ozel_id.ilike.%${safe}%`)
    .order("deneyim_puani", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PublicProfile[]) ?? [];
}

/** Özel ID ayarla (kapsül 6-7 / premium ≤5). Sunucu entitlement+benzersizlik zorlar. */
export async function setOzelId(id: string, tip: "premium" | "kapsul", tema: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("ozel_id_ayarla", { p_id: id, p_tip: tip, p_tema: tema });
  if (error) throw error;
  invalidateProfileMemo();
}

/** Özel ID'yi kaldır. */
export async function clearOzelId(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("ozel_id_kaldir");
  if (error) throw error;
  invalidateProfileMemo();
}

/** Beta + özel ID yoksa Sistem DM hatırlatması at (idempotent — sunucu bir kez). */
export async function betaKapsulHatirlat(): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("beta_kapsul_hatirlat");
  if (error) throw error;
}
