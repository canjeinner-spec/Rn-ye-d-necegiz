import { requireSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type Balance = { elmas: number; altin: number };

export type LedgerRow = {
  id: number;
  varlik: "elmas" | "altin";
  miktar: number; // +/-
  sebep: string | null;
  at: number; // epoch ms
};

/** Kendi bakiyem (elmas + altın). Yapılandırılmamış/hata → 0. */
export async function getMyBalance(): Promise<Balance> {
  if (!isSupabaseConfigured) return { elmas: 0, altin: 0 };
  try {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc("benim_bakiyem");
    if (error) return { elmas: 0, altin: 0 };
    const row = Array.isArray(data) ? data[0] : data;
    return { elmas: Number(row?.elmas ?? 0), altin: Number(row?.altin ?? 0) };
  } catch {
    return { elmas: 0, altin: 0 };
  }
}

/** Kendi işlem geçmişim (yeniden eskiye). */
export async function listMyLedger(limit = 40): Promise<LedgerRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = requireSupabase();
    const { data } = await sb
      .from("cuzdan_hareketleri")
      .select("id, varlik, miktar, sebep, tarih")
      .order("id", { ascending: false })
      .limit(limit);
    return ((data as { id: number; varlik: "elmas" | "altin"; miktar: number; sebep: string | null; tarih: string }[]) ?? []).map((r) => ({
      id: r.id,
      varlik: r.varlik,
      miktar: Number(r.miktar),
      sebep: r.sebep,
      at: new Date(r.tarih).getTime(),
    }));
  } catch {
    return [];
  }
}

/** Kullanıcıya varlık gönder (kendi bakiyenden düşer). */
export async function transfer(hedefId: number, varlik: "elmas" | "altin", miktar: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.rpc("bakiye_transfer", { p_hedef: hedefId, p_varlik: varlik, p_miktar: miktar });
  if (error) throw error;
}
