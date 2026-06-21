import { type DMThread } from "@/data/dm";
import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

// Gerçek DB thread id'leri mock DM_THREADS (1..9) ile çakışmasın diye offset.
const DM_ID_OFFSET = 1_000_000_000;

export type DMMessage = { id: number; me: boolean; text: string; time: string };

function hhmm(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

type KonusmaRow = { id: number; kullanici1_id: number; kullanici2_id: number; son_mesaj_tarihi: string | null };
type MesajRow = { id: number; konusma_id: number; gonderen_id: number; icerik: string; okunma_tarihi: string | null; gonderilme_tarihi: string };

/** Benim konuşmalarım → DMThread listesi (karşı kişi profili + son mesaj + okunmamış). */
export async function listThreads(): Promise<DMThread[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) return [];

  const { data: convData, error } = await sb
    .from("dm_konusmalari")
    .select("id, kullanici1_id, kullanici2_id, son_mesaj_tarihi")
    .order("son_mesaj_tarihi", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const convs = (convData as KonusmaRow[]) ?? [];
  if (convs.length === 0) return [];

  const convIds = convs.map((c) => c.id);
  const otherIds = convs.map((c) => (c.kullanici1_id === me.id ? c.kullanici2_id : c.kullanici1_id));

  // Karşı profiller + tüm mesajlar (son mesaj & okunmamış için) — paralel.
  const [profRes, msgRes] = await Promise.all([
    sb.from("profiller").select("id, public_id, kullanici_adi, profil_resmi").in("id", [...new Set(otherIds)]),
    sb.from("dm_mesajlari").select("konusma_id, gonderen_id, icerik, okunma_tarihi, gonderilme_tarihi").in("konusma_id", convIds).order("gonderilme_tarihi", { ascending: false }),
  ]);
  const profs = new Map<number, { public_id: string; kullanici_adi: string; profil_resmi: string | null }>();
  for (const p of (profRes.data as { id: number; public_id: string; kullanici_adi: string; profil_resmi: string | null }[]) ?? []) profs.set(p.id, p);

  const msgs = (msgRes.data as Pick<MesajRow, "konusma_id" | "gonderen_id" | "icerik" | "okunma_tarihi" | "gonderilme_tarihi">[]) ?? [];
  const lastByConv = new Map<number, (typeof msgs)[number]>();
  const unreadByConv = new Map<number, number>();
  for (const m of msgs) {
    if (!lastByConv.has(m.konusma_id)) lastByConv.set(m.konusma_id, m); // ilk = en yeni (desc)
    if (m.gonderen_id !== me.id && m.okunma_tarihi == null) unreadByConv.set(m.konusma_id, (unreadByConv.get(m.konusma_id) ?? 0) + 1);
  }

  return convs.map((c) => {
    const otherId = c.kullanici1_id === me.id ? c.kullanici2_id : c.kullanici1_id;
    const prof = profs.get(otherId);
    const last = lastByConv.get(c.id);
    return {
      id: DM_ID_OFFSET + c.id,
      convId: c.id,
      name: prof?.kullanici_adi || "Kullanıcı",
      publicId: prof?.public_id,
      photo: prof?.profil_resmi || undefined,
      last: last ? last.icerik : "Yeni sohbet",
      time: c.son_mesaj_tarihi ? hhmm(c.son_mesaj_tarihi) : "",
      unread: unreadByConv.get(c.id) ?? 0,
      online: false,
    };
  });
}

/** Konuşmanın mesajları (eskiden yeniye). */
export async function getMessages(convId: number): Promise<DMMessage[]> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  const { data, error } = await sb
    .from("dm_mesajlari")
    .select("id, konusma_id, gonderen_id, icerik, gonderilme_tarihi")
    .eq("konusma_id", convId)
    .order("gonderilme_tarihi", { ascending: true });
  if (error) throw error;
  return ((data as MesajRow[]) ?? []).map((m) => ({ id: m.id, me: m.gonderen_id === me?.id, text: m.icerik, time: hhmm(m.gonderilme_tarihi) }));
}

/** Mesaj gönder; eklenen satırı DMMessage olarak döndürür. */
export async function sendMessage(convId: number, text: string): Promise<DMMessage> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { data, error } = await sb
    .from("dm_mesajlari")
    .insert({ konusma_id: convId, gonderen_id: me.id, icerik: text.trim() })
    .select("id, gonderilme_tarihi")
    .single();
  if (error) throw error;
  const row = data as { id: number; gonderilme_tarihi: string };
  return { id: row.id, me: true, text: text.trim(), time: hhmm(row.gonderilme_tarihi) };
}

/** Karşı kullanıcı (kullanicilar.id) ile konuşmayı bul ya da oluştur → convId. */
export async function getOrCreateConversation(otherUserId: number): Promise<number> {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("dm_konusma_bul_olustur", { p_diger_id: otherUserId });
  if (error) throw error;
  return data as number;
}

/** Karşıdan gelen okunmamışları okundu işaretle. */
export async function markRead(convId: number): Promise<void> {
  const sb = requireSupabase();
  await sb.rpc("dm_okundu", { p_konusma_id: convId });
}

/** Bir DB mesaj satırını (realtime payload) DMMessage'a çevirir. */
export function mapRealtimeMessage(row: MesajRow, myId: number | null): DMMessage {
  return { id: row.id, me: row.gonderen_id === myId, text: row.icerik, time: hhmm(row.gonderilme_tarihi) };
}
