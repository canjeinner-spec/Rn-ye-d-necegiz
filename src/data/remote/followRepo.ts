import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

const T = "kullanicilar_takip";

/** Bir kullanıcının takipçi + takip-edilen sayıları. */
export async function getFollowCounts(userId: number): Promise<{ followers: number; following: number }> {
  const sb = requireSupabase();
  const [f1, f2] = await Promise.all([
    sb.from(T).select("takip_eden_id", { count: "exact", head: true }).eq("takip_edilen_id", userId),
    sb.from(T).select("takip_eden_id", { count: "exact", head: true }).eq("takip_eden_id", userId),
  ]);
  return { followers: f1.count ?? 0, following: f2.count ?? 0 };
}

/** Bu kullanıcıyı takip ediyor muyum? */
export async function isFollowing(targetUserId: number): Promise<boolean> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return false;
  const { data } = await sb.from(T).select("takip_eden_id").eq("takip_eden_id", me.id).eq("takip_edilen_id", targetUserId).maybeSingle();
  return !!data;
}

/** Sayaç + takip durumu (profil ekranı için tek seferde). */
export async function getFollowState(targetUserId: number): Promise<{ followers: number; following: number; isFollowing: boolean }> {
  const [counts, mine] = await Promise.all([getFollowCounts(targetUserId), isFollowing(targetUserId)]);
  return { ...counts, isFollowing: mine };
}

/**
 * Takip ettiğim kullanıcıların id'leri — akıştaki "Takip Edilen" sekmesi.
 *
 * Sayaç değil liste gerekiyor: sekme gönderileri yazar id'sine göre süzüyor.
 * Oturum yoksa boş dizi dönüyor, sekme de boş durumunu gösteriyor.
 */
export async function takipEttiklerim(): Promise<number[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];
  const { data, error } = await sb.from(T).select("takip_edilen_id").eq("takip_eden_id", me.id);
  if (error) throw error;
  return ((data as { takip_edilen_id: number }[]) ?? []).map((r) => r.takip_edilen_id);
}

/** Takip et (kendi adına; zaten takipliyse yutulur). */
export async function follow(targetUserId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from(T).insert({ takip_eden_id: me.id, takip_edilen_id: targetUserId });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Takibi bırak. */
export async function unfollow(targetUserId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return;
  const { error } = await sb.from(T).delete().eq("takip_eden_id", me.id).eq("takip_edilen_id", targetUserId);
  if (error) throw error;
}
