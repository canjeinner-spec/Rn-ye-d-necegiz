import { type FeedPost, type FeedScope } from "@/data/feed";
import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

// DB gönderi id'leri (BIGSERIAL, 1'den başlar) mock FEED_SEED id'leriyle
// çakışmasın diye offset'liyoruz; React key + birleştirme güvenli olur.
const FEED_ID_OFFSET = 1_000_000_000;

const SELECT_COLS =
  "id, public_id, kullanici_id, icerik, kapsam, begeni_sayisi, yorum_sayisi, olusturulma_tarihi";

type GonderiRow = {
  id: number;
  public_id: string;
  kullanici_id: number;
  icerik: string | null;
  kapsam: string;
  begeni_sayisi: number;
  yorum_sayisi: number;
  olusturulma_tarihi: string;
};

type Author = { kullanici_adi: string; seviye_id: number | null };

function toScope(kapsam: string): FeedScope {
  return kapsam === "arkadaslar" ? "arkadaslar" : "herkes";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function mapPost(r: GonderiRow, author: Author | undefined, myId: number | null): FeedPost {
  return {
    id: FEED_ID_OFFSET + r.id,
    type: "user",
    who: author?.kullanici_adi || "Kullanıcı",
    lv: author?.seviye_id ?? 1,
    vip: false,
    body: r.icerik || "",
    when: timeAgo(r.olusturulma_tarihi),
    likes: r.begeni_sayisi,
    room: null,
    scope: toScope(r.kapsam),
    comments: [],
    mine: myId != null && r.kullanici_id === myId,
  };
}

/** kullanici_id → { ad, seviye } (profiller view, RLS-bypass) toplu eşleme. */
async function fetchAuthors(ids: number[]): Promise<Map<number, Author>> {
  const map = new Map<number, Author>();
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return map;
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id, kullanici_adi, seviye_id").in("id", uniq);
  for (const row of (data as { id: number; kullanici_adi: string; seviye_id: number | null }[]) ?? []) {
    map.set(row.id, { kullanici_adi: row.kullanici_adi, seviye_id: row.seviye_id });
  }
  return map;
}

/** Akış gönderileri (yeniden eskiye). Yalnızca metin gönderileri. */
export async function listPosts(limit = 50): Promise<FeedPost[]> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    // silinmis/kapsam filtresi RLS policy'sinde; client'ta o kolonları filtrelemeyiz.
    sb.from("gonderiler").select(SELECT_COLS).order("olusturulma_tarihi", { ascending: false }).limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as GonderiRow[]) ?? [];
  const authors = await fetchAuthors(rows.map((r) => r.kullanici_id));
  return rows.map((r) => mapPost(r, authors.get(r.kullanici_id), me?.id ?? null));
}

function genPublicId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 12);
}

/** Yeni metin gönderisi paylaş (kendi adına). Oluşan FeedPost'u döndürür. */
export async function createPost(icerik: string): Promise<FeedPost> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await sb
      .from("gonderiler")
      .insert({
        public_id: genPublicId(),
        kullanici_id: me.id,
        icerik: icerik.trim(),
        kapsam: "herkes",
      })
      .select(SELECT_COLS)
      .single();
    if (!error && data) {
      return mapPost(data as GonderiRow, { kullanici_adi: me.kullanici_adi, seviye_id: me.seviye_id }, me.id);
    }
    if ((error as { code?: string } | null)?.code === "23505") { lastErr = error; continue; }
    throw error;
  }
  throw lastErr ?? new Error("Gönderi paylaşılamadı.");
}
