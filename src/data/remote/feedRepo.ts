import { type FeedComment, type FeedPost, type FeedScope } from "@/data/feed";
import { getMyProfile } from "@/data/remote/profileRepo";
import { requireSupabase } from "@/lib/supabase";

// DB gönderi id'leri (BIGSERIAL, 1'den başlar) mock FEED_SEED id'leriyle
// çakışmasın diye offset'liyoruz; React key + birleştirme güvenli olur.
export const FEED_ID_OFFSET = 1_000_000_000;

const SELECT_COLS =
  "id, public_id, kullanici_id, icerik, kapsam, begeni_sayisi, yorum_sayisi, sabitlenmis, olusturulma_tarihi";

type GonderiRow = {
  id: number;
  public_id: string;
  kullanici_id: number;
  icerik: string | null;
  kapsam: string;
  begeni_sayisi: number;
  yorum_sayisi: number;
  sabitlenmis: boolean;
  olusturulma_tarihi: string;
};

type Author = { kullanici_adi: string; seviye_id: number | null; public_id: string };

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

function mapPost(r: GonderiRow, author: Author | undefined, myId: number | null, comments: FeedComment[]): FeedPost {
  return {
    id: FEED_ID_OFFSET + r.id,
    type: "user",
    who: author?.kullanici_adi || "Kullanıcı",
    publicId: author?.public_id,
    lv: author?.seviye_id ?? 1,
    vip: false,
    body: r.icerik || "",
    when: timeAgo(r.olusturulma_tarihi),
    likes: r.begeni_sayisi,
    room: null,
    scope: toScope(r.kapsam),
    comments,
    mine: myId != null && r.kullanici_id === myId,
    pinned: r.sabitlenmis,
  };
}

/** kullanici_id → { ad, seviye } (profiller view, RLS-bypass) toplu eşleme. */
async function fetchAuthors(ids: number[]): Promise<Map<number, Author>> {
  const map = new Map<number, Author>();
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return map;
  const sb = requireSupabase();
  const { data } = await sb.from("profiller").select("id, public_id, kullanici_adi, seviye_id").in("id", uniq);
  for (const row of (data as { id: number; public_id: string; kullanici_adi: string; seviye_id: number | null }[]) ?? []) {
    map.set(row.id, { kullanici_adi: row.kullanici_adi, seviye_id: row.seviye_id, public_id: row.public_id });
  }
  return map;
}

type YorumRow = { id: number; gonderi_id: number; kullanici_id: number; icerik: string; olusturulma_tarihi: string };

export type FeedResult = { posts: FeedPost[]; likedIds: number[] };

/** Akış gönderileri (yeniden eskiye) + üst-seviye yorumlar + benim beğenilerim. */
export async function listPosts(limit = 50): Promise<FeedResult> {
  const sb = requireSupabase();
  const [{ data, error }, me] = await Promise.all([
    // silinmis/kapsam filtresi RLS policy'sinde; client'ta o kolonları filtrelemeyiz.
    sb
      .from("gonderiler")
      .select(SELECT_COLS)
      .order("sabitlenmis", { ascending: false }) // sabitlenenler üstte
      .order("olusturulma_tarihi", { ascending: false })
      .limit(limit),
    getMyProfile().catch(() => null),
  ]);
  if (error) throw error;
  const rows = (data as GonderiRow[]) ?? [];
  if (rows.length === 0) return { posts: [], likedIds: [] };
  const postIds = rows.map((r) => r.id);

  // Yorumlar (üst-seviye) + benim beğenilerim — paralel.
  const [commentsRes, likesRes] = await Promise.all([
    sb
      .from("gonderi_yorumlari")
      .select("id, gonderi_id, kullanici_id, icerik, olusturulma_tarihi")
      .in("gonderi_id", postIds)
      .is("ust_yorum_id", null)
      .order("olusturulma_tarihi", { ascending: true }),
    me
      ? sb.from("gonderi_begeniler").select("gonderi_id").eq("kullanici_id", me.id).in("gonderi_id", postIds)
      : Promise.resolve({ data: [] as { gonderi_id: number }[] }),
  ]);
  const comments = (commentsRes.data as YorumRow[]) ?? [];
  const myLikes = new Set(((likesRes.data as { gonderi_id: number }[]) ?? []).map((x) => x.gonderi_id));

  // Yazar adları: gönderi + yorum yazarları birlikte.
  const authors = await fetchAuthors([...rows.map((r) => r.kullanici_id), ...comments.map((c) => c.kullanici_id)]);

  // Yorumları gönderiye göre grupla.
  const byPost = new Map<number, FeedComment[]>();
  for (const c of comments) {
    const arr = byPost.get(c.gonderi_id) ?? [];
    arr.push({ who: authors.get(c.kullanici_id)?.kullanici_adi || "Kullanıcı", text: c.icerik, mine: me?.id === c.kullanici_id, replies: [] });
    byPost.set(c.gonderi_id, arr);
  }

  const posts = rows.map((r) => mapPost(r, authors.get(r.kullanici_id), me?.id ?? null, byPost.get(r.id) ?? []));
  const likedIds = rows.filter((r) => myLikes.has(r.id)).map((r) => FEED_ID_OFFSET + r.id);
  return { posts, likedIds };
}

/** Gönderiyi beğen (kendi adına; zaten beğenildiyse yutulur). */
export async function likePost(postDbId: number): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from("gonderi_begeniler").insert({ gonderi_id: postDbId, kullanici_id: me.id });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

/** Beğeniyi geri al (RLS yalnızca kendi satırını siler). */
export async function unlikePost(postDbId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("gonderi_begeniler").delete().eq("gonderi_id", postDbId);
  if (error) throw error;
}

/** Gönderiye üst-seviye yorum ekle (kendi adına). */
export async function addComment(postDbId: number, icerik: string): Promise<void> {
  const sb = requireSupabase();
  const me = await getMyProfile();
  if (!me) throw new Error("Profil bulunamadı.");
  const { error } = await sb.from("gonderi_yorumlari").insert({ gonderi_id: postDbId, kullanici_id: me.id, icerik: icerik.trim() });
  if (error) throw error;
}

/** Kendi gönderinin içeriğini düzenle (RLS yalnızca kendi satırını günceller). */
export async function editPost(postDbId: number, icerik: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("gonderiler").update({ icerik: icerik.trim() }).eq("id", postDbId);
  if (error) throw error;
}

/** Kendi gönderini sil (soft-delete: silinmis=true → akıştan düşer). */
export async function deletePost(postDbId: number): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("gonderiler").update({ silinmis: true }).eq("id", postDbId);
  if (error) throw error;
}

/** Kendi gönderini sabitle / sabitlemeyi kaldır. */
export async function setPinned(postDbId: number, pinned: boolean): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("gonderiler").update({ sabitlenmis: pinned }).eq("id", postDbId);
  if (error) throw error;
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
      return mapPost(data as GonderiRow, { kullanici_adi: me.kullanici_adi, seviye_id: me.seviye_id, public_id: me.public_id }, me.id, []);
    }
    if ((error as { code?: string } | null)?.code === "23505") { lastErr = error; continue; }
    throw error;
  }
  throw lastErr ?? new Error("Gönderi paylaşılamadı.");
}
