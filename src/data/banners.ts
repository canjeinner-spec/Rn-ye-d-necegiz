/**
 * Üst etkinlik banner'ları (oda listesi) + tıklanınca açılan etkinlik sayfası verisi.
 * Şema: etkinlikler / banner_kampanyalari.
 */
export type EventBanner = {
  id: string;
  title: string;
  date: string;
  c1: string;
  c2: string;
  accent: string;
  /** Banner türü — "about"/"update" bilgilendirme banner'ları için özel görünüm */
  kind?: "event" | "about" | "update";
  /** about için alt başlık */
  subtitle?: string;
  /** Verilirse banner'a tam-kaplama görsel basılır (expo-image). Kaliteli görsel için */
  image?: string;
  /** Özel hedef rota (verilmezse /event?id=... açılır) */
  route?: string;
};

export const EVENT_BANNERS: EventBanner[] = [
  { id: "yildiz", title: "Yıldız Koleksiyon Kartı", date: "4/6/2026 22:00 – 25/7/2026 21:59 (UTC+3)", c1: "#7C3AED", c2: "#C026D3", accent: "#FDE68A" },
  { id: "hakkimizda", kind: "about", title: "Biz Kimiz?", subtitle: "Aron Chat'in hikâyesi", date: "", c1: "#26203F", c2: "#0C0A16", accent: "#F5CE6E", route: "/about" },
  { id: "guncelleme", kind: "update", title: "Gelecek Güncelleme", subtitle: "Sırada ne var?", date: "", c1: "#0E2A2A", c2: "#0A1018", accent: "#5EEAD4", route: "/updates" },
  { id: "futbol", title: "Futbol Şampiyonası", date: "9/6/2026 – 16/6/2026 (UTC+3)", c1: "#047857", c2: "#0E7490", accent: "#FEF3C7" },
  { id: "sevgi", title: "Sevgi Festivali", date: "14/6/2026 – 21/6/2026 (UTC+3)", c1: "#BE185D", c2: "#7C3AED", accent: "#FBCFE8" },
];

export const findBanner = (id?: string) => EVENT_BANNERS.find((b) => b.id === id) || EVENT_BANNERS[0];

// "Kart Kralı" — en değerli 3 kart
export type KingCard = { name: string; tag: string; val: number; c: string };
export const KART_KRALI: KingCard[] = [
  { name: "BOSS", tag: "NextᴮBOSS", val: 2170, c: "#3B82F6" },
  { name: "Pearl", tag: "NextFearl", val: 1332, c: "#A855F7" },
  { name: "Pikachu", tag: "DJ Pikach", val: 908, c: "#F5CE6E" },
];

export type Rarity = "normal" | "rare" | "epic" | "legendary";
export const RARE_RING: Record<Rarity, string> = {
  normal: "rgba(255,255,255,.25)",
  rare: "#60A5FA",
  epic: "#A855F7",
  legendary: "#F5CE6E",
};

export type CollectCard = { id: number; name: string; num: number; val: number; c1: string; c2: string; rare: Rarity; owned: boolean };
export const COLLECT_CARDS: CollectCard[] = [
  { id: 1, name: "Defans", num: 22, val: 100, c1: "#1D4ED8", c2: "#0C4A6E", rare: "normal", owned: true },
  { id: 2, name: "Forvet", num: 19, val: 300, c1: "#9A3412", c2: "#7F1D1D", rare: "rare", owned: true },
  { id: 3, name: "Kaleci", num: 1, val: 150, c1: "#065F46", c2: "#064E3B", rare: "normal", owned: true },
  { id: 4, name: "Orta Saha", num: 10, val: 500, c1: "#6D28D9", c2: "#581C87", rare: "epic", owned: false },
  { id: 5, name: "Kanat", num: 7, val: 250, c1: "#BE185D", c2: "#9D174D", rare: "rare", owned: false },
  { id: 6, name: "Kaptan", num: 9, val: 888, c1: "#B45309", c2: "#92400E", rare: "legendary", owned: false },
];
