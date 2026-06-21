import { type SceneKind } from "@/components/Scene";
import { type Room } from "@/data/seed";
import { requireSupabase } from "@/lib/supabase";
import { getMyProfile } from "@/data/remote/profileRepo";

const SELECT_COLS =
  "id, public_id, ad, aciklama, kategori, kapak_url, herkese_acik, olusturan_id, koltuk_sayisi, aktif_katilimci_sayisi, olusturulma_tarihi";

type OdaRow = {
  id: number;
  public_id: string;
  ad: string;
  aciklama: string | null;
  kategori: string | null;
  kapak_url: string | null;
  herkese_acik: boolean;
  olusturan_id: number | null;
  koltuk_sayisi: number;
  aktif_katilimci_sayisi: number;
  olusturulma_tarihi: string;
};

const SCENES: SceneKind[] = ["official", "club", "lounge", "night", "fire"];
function toScene(kategori: string | null): SceneKind {
  return kategori && (SCENES as string[]).includes(kategori) ? (kategori as SceneKind) : "club";
}

/** odalar satırını uygulamanın Room tipine çevirir. */
function mapRoom(r: OdaRow, hostName: string, myId: number | null): Room {
  return {
    id: r.public_id,
    name: r.ad,
    host: hostName,
    online: r.aktif_katilimci_sayisi,
    mic: 0, // canlı koltuk verisi Faz 4 (presence) ile gelecek
    extra: r.aktif_katilimci_sayisi,
    live: true,
    scene: toScene(r.kategori),
    locked: !r.herkese_acik,
    owner: myId != null && r.olusturan_id === myId,
    crowd: [],
    photo: r.kapak_url || undefined,
  };
}

/** olusturan_id → kullanici_adi (profiller view, RLS-bypass) toplu eşleme. */
async function fetchHostNames(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniq = [...new Set(ids.filter((x): x is number => x != null))];
  if (uniq.length === 0) return map;
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id, kullanici_adi").in("id", uniq);
  for (const row of (data as { id: number; kullanici_adi: string }[]) ?? []) {
    map.set(row.id, row.kullanici_adi);
  }
  return map;
}

/** Herkese açık odalar (kalabalığa göre sıralı). */
export async function listRooms(limit = 50): Promise<Room[]> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    // Not: silinmis filtresi RLS policy'sinde (USING) zaten var; client'ta
    // silinmis kolonuna SELECT yetkisi olmadığından burada filtrelemeyiz.
    sb
      .from("odalar")
      .select(SELECT_COLS)
      .eq("herkese_acik", true)
      .order("aktif_katilimci_sayisi", { ascending: false })
      .order("olusturulma_tarihi", { ascending: false })
      .limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as OdaRow[]) ?? [];
  const hosts = await fetchHostNames(rows.map((r) => r.olusturan_id).filter((x): x is number => x != null));
  return rows.map((r) => mapRoom(r, hosts.get(r.olusturan_id ?? -1) || "Kullanıcı", me?.id ?? null));
}

/** 6 haneli benzersiz oda ID'si (çakışmada birkaç kez dener). */
function genRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 899999));
}

/** Yeni oda oluştur (kendi adına). Oluşan Room'u döndürür. */
export async function createRoom(input: {
  name: string;
  photo?: string | null;
  aciklama?: string | null;
  kategori?: string | null;
}): Promise<Room> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await sb
      .from("odalar")
      .insert({
        public_id: genRoomId(),
        ad: input.name.trim(),
        aciklama: input.aciklama ?? null,
        kategori: input.kategori ?? "club",
        kapak_url: input.photo ?? null,
        herkese_acik: true,
        olusturan_id: me.id,
        koltuk_sayisi: 8,
      })
      .select(SELECT_COLS)
      .single();
    if (!error && data) {
      return mapRoom(data as OdaRow, me.kullanici_adi, me.id);
    }
    // 23505 = unique_violation (public_id çakışması) → yeni ID ile tekrar dene
    if ((error as { code?: string } | null)?.code === "23505") { lastErr = error; continue; }
    throw error;
  }
  throw lastErr ?? new Error("Oda oluşturulamadı.");
}
