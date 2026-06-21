/**
 * Akış (Feed) verisi — kullanıcı gönderileri gonderiler tablosuyla uyumlu.
 * "system" tipi gönderiler Aron'un üretilmiş tebrik/spotlight kartlarıdır (resmi).
 */
export type FeedScope = "herkes" | "arkadaslar";

export type FeedReply = { who: string; text: string; mine?: boolean };
export type FeedComment = { who: string; text: string; mine?: boolean; replies: FeedReply[] };

export type FeedPost =
  | {
      id: number;
      type: "system";
      who: string;
      title: string;
      body: string;
      spotlight: { name: string; sub: string; c1: string; c2: string };
      when: string;
    }
  | {
      id: number;
      type: "user";
      who: string;
      publicId?: string; // gönderi sahibinin public_id'si (DB gönderilerinde) → profile git
      lv: number;
      vip: boolean;
      body: string;
      when: string;
      likes: number;
      room?: { name: string; id: string } | null;
      scope: FeedScope;
      comments: FeedComment[];
      mine?: boolean;
      pinned?: boolean;
    };

export const SCOPE_LABEL: Record<FeedScope, { t: string; ic: string }> = {
  herkes: { t: "Herkes yanıtlayabilir", ic: "M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" },
  arkadaslar: { t: "Arkadaşların yanıtlayabilir", ic: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M21 20a6 6 0 0 0-5-5.9" },
};

export const FEED_SEED: FeedPost[] = [
  { id: 1, type: "system", who: "Aron", title: "Günün yıldızı!", body: "Tebrikler 🦇 BASTA! Bugünkü sıralamada birinci oldun.", spotlight: { name: "Ardaowski", sub: "62.783 gelişme değeri", c1: "#F5CE6E", c2: "#D9920F" }, when: "00:00" },
  { id: 2, type: "user", who: "Zeno Sv.", lv: 42, vip: true, body: "BUZ VE ATEŞ — Altın Lotus yüzükleri karşılıklı takılıp çıkarılır. Odaya bekleriz!", when: "13 dk önce", likes: 24, room: null, scope: "herkes", comments: [{ who: "Mervee", text: "Geliyorum hemen!", mine: false, replies: [] }] },
  { id: 3, type: "user", who: "Lunas", lv: 33, vip: false, body: "Bu akşam 21:00'de açılış yapıyoruz, hep beraber eğlenelim ✨", when: "40 dk önce", likes: 12, room: { name: "Gece Kuşları", id: "145632" }, scope: "herkes", comments: [] },
  { id: 4, type: "system", who: "Aron", title: "Günün en cömerti!", body: "Tebrikler 🌹 Mervee! Bugün en çok hediye gönderen sen oldun.", spotlight: { name: "Mervee", sub: "3.939.194 gül", c1: "#60A5FA", c2: "#2563EB" }, when: "00:00" },
  { id: 5, type: "user", who: "Furkan", lv: 24, vip: false, body: "Yeni odam açıldı, sohbet sevenleri beklerim 🎙️", when: "2 saat önce", likes: 8, room: { name: "Sohbet Durağı", id: "145901" }, scope: "herkes", comments: [] },
];
