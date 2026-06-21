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
};

const SELF_COLS =
  "id, public_id, kullanici_adi, email, profil_resmi, biyografi, cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum, ekonomi_rolu";

/** Giriş yapan kullanıcının kendi profili (kullanicilar, RLS: kendi satırı). */
export async function getMyProfile(): Promise<Profile | null> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb
    .from("kullanicilar")
    .select(SELF_COLS)
    .eq("auth_uid", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/** Kendi profilini güncelle (yalnızca izinli kolonlar; RLS + kolon-yetkisi korur). */
export async function updateMyProfile(
  patch: Partial<Pick<Profile, "kullanici_adi" | "profil_resmi" | "biyografi" | "cinsiyet" | "ulke" | "sehir">>,
): Promise<Profile> {
  const sb = requireSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Oturum yok.");
  const { data, error } = await sb
    .from("kullanicilar")
    .update(patch)
    .eq("auth_uid", auth.user.id)
    .select(SELF_COLS)
    .single();
  if (error) throw error;
  return data as Profile;
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
};

const PUBLIC_COLS =
  "id, public_id, kullanici_adi, profil_resmi, biyografi, cinsiyet, ulke, sehir, seviye_id, deneyim_puani, durum, ekonomi_rolu";

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

/** Kullanıcı arama — görünen ad (kullanici_adi) veya public_id ile (case-insensitive). */
export async function searchProfiles(query: string, limit = 20): Promise<PublicProfile[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sb = requireSupabase();
  const safe = q.replace(/[%,]/g, ""); // PostgREST or-filtresini bozacak karakterleri çıkar
  const { data, error } = await sb
    .from("profiller")
    .select(PUBLIC_COLS)
    .or(`kullanici_adi.ilike.%${safe}%,public_id.ilike.%${safe}%`)
    .order("deneyim_puani", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as PublicProfile[]) ?? [];
}
