import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

// v7 şemasında "raporlar" adında farklı bir tablo zaten var → bizimki "sikayetler"
const T = "sikayetler";

/** Kullanıcıyı raporla (kullanicilar.id ile). */
export async function reportUserById(targetUserId: number, neden: string, detay?: string): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from(T).insert({
    tip: "kullanici",
    raporlayan_id: me.id,
    hedef_kullanici_id: targetUserId,
    neden,
    detay: detay?.trim() || null,
  });
  if (error) throw error;
}

/** Kullanıcıyı public_id ile raporla (kartlarda yalnızca publicId bilinir). */
export async function reportUserByPublicId(publicId: string, neden: string, detay?: string): Promise<void> {
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id").eq("public_id", publicId).maybeSingle();
  const id = (data as { id: number } | null)?.id;
  if (id == null) throw new Error("Kullanıcı bulunamadı.");
  await reportUserById(id, neden, detay);
}

/** Odayı raporla (odalar.id ile). */
export async function reportRoom(odaId: number, neden: string, detay?: string): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from(T).insert({
    tip: "oda",
    raporlayan_id: me.id,
    hedef_oda_id: odaId,
    neden,
    detay: detay?.trim() || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Yönetim ekranı (yalnızca platform yöneticileri — RLS zaten kısıtlar)
// ---------------------------------------------------------------------------

export type ReportRow = {
  id: number;
  tip: "kullanici" | "oda";
  neden: string;
  detay: string | null;
  durum: "bekliyor" | "incelendi";
  at: number;
  raporlayan: string;
  hedef: string; // kullanıcı adı ya da oda adı
  hedefKullaniciId: number | null;
  hedefPublicId?: string;
};

/** Raporları listele (yeniden eskiye). Yönetici tümünü, kullanıcı kendininkini görür. */
export async function listReports(limit = 100): Promise<ReportRow[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from(T)
    .select("id, tip, raporlayan_id, hedef_kullanici_id, hedef_oda_id, neden, detay, durum, olusturulma_tarihi")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data as {
    id: number; tip: "kullanici" | "oda"; raporlayan_id: number;
    hedef_kullanici_id: number | null; hedef_oda_id: number | null;
    neden: string; detay: string | null; durum: "bekliyor" | "incelendi"; olusturulma_tarihi: string;
  }[]) ?? [];

  const userIds = [...new Set(rows.flatMap((r) => [r.raporlayan_id, r.hedef_kullanici_id]).filter((x): x is number => x != null))];
  const odaIds = [...new Set(rows.map((r) => r.hedef_oda_id).filter((x): x is number => x != null))];
  const profs = new Map<number, { kullanici_adi: string; public_id: string }>();
  const odalar = new Map<number, string>();
  if (userIds.length) {
    const { data: ps } = await sb.from("profiller").select("id, public_id, kullanici_adi").in("id", userIds);
    for (const p of (ps as { id: number; public_id: string; kullanici_adi: string }[]) ?? []) profs.set(p.id, p);
  }
  if (odaIds.length) {
    const { data: os } = await sb.from("odalar").select("id, ad").in("id", odaIds);
    for (const o of (os as { id: number; ad: string }[]) ?? []) odalar.set(o.id, o.ad);
  }
  return rows.map((r) => ({
    id: r.id,
    tip: r.tip,
    neden: r.neden,
    detay: r.detay,
    durum: r.durum,
    at: new Date(r.olusturulma_tarihi).getTime(),
    raporlayan: profs.get(r.raporlayan_id)?.kullanici_adi || "Kullanıcı",
    hedef: r.tip === "kullanici"
      ? profs.get(r.hedef_kullanici_id ?? -1)?.kullanici_adi || "Kullanıcı"
      : odalar.get(r.hedef_oda_id ?? -1) || "Oda",
    hedefKullaniciId: r.hedef_kullanici_id,
    hedefPublicId: r.hedef_kullanici_id != null ? profs.get(r.hedef_kullanici_id)?.public_id : undefined,
  }));
}

/** Raporu incelendi/bekliyor işaretle (yalnızca yönetici — RLS). */
export async function setReportStatus(id: number, durum: "bekliyor" | "incelendi"): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from(T).update({ durum }).eq("id", id);
  if (error) throw error;
}
