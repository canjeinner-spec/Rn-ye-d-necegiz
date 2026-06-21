import { getMyProfile, getPublicProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

const T = "kullanici_engelleri";

export type BlockState = {
  /** Ben bu kişiyi engelledim mi? */
  iBlocked: boolean;
  /** Bu kişi beni engelledi mi? */
  blockedByThem: boolean;
};

type EngelRow = { engelleyen_id: number; engellenen_id: number };

/** İki kullanıcı arasındaki engel durumu (her iki yön). */
export async function getBlockState(targetUserId: number): Promise<BlockState> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return { iBlocked: false, blockedByThem: false };
  const { data } = await sb
    .from(T)
    .select("engelleyen_id, engellenen_id")
    .or(
      `and(engelleyen_id.eq.${me.id},engellenen_id.eq.${targetUserId}),` +
        `and(engelleyen_id.eq.${targetUserId},engellenen_id.eq.${me.id})`,
    );
  const rows = (data as EngelRow[]) ?? [];
  return {
    iBlocked: rows.some((r) => r.engelleyen_id === me.id),
    blockedByThem: rows.some((r) => r.engelleyen_id === targetUserId),
  };
}

/** public_id ile engel durumu + çözülmüş hedef kullanıcı id'si (DM ekranı için). */
export async function getBlockStateByPublicId(
  publicId: string,
): Promise<BlockState & { targetId: number | null }> {
  const target = await getPublicProfile(publicId);
  if (!target) return { iBlocked: false, blockedByThem: false, targetId: null };
  const st = await getBlockState(target.id);
  return { ...st, targetId: target.id };
}

/** Bu kişiyi engelle (kendi adına; zaten engelliyse yutulur). */
export async function block(targetUserId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from(T).insert({ engelleyen_id: me.id, engellenen_id: targetUserId });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Engeli kaldır. */
export async function unblock(targetUserId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return;
  const { error } = await sb.from(T).delete().eq("engelleyen_id", me.id).eq("engellenen_id", targetUserId);
  if (error) throw error;
}
