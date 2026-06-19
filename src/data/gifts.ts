export type GiftTier = "normal" | "rare" | "epic" | "legendary";
export type Gift = { id: string; emoji: string; name: string; price: number; c1: string; c2: string; tier: GiftTier };

export const GIFT_TABS = ["Hediye", "Love", "Lucky", "Şanslı Çekiliş", "Aristokrat", "CP", "Özel"];

export const TIER_RING: Record<GiftTier, string> = {
  normal: "rgba(255,255,255,.18)",
  rare: "#60A5FA",
  epic: "#A855F7",
  legendary: "#F5CE6E",
};

export const GIFTS: Record<number, Gift[]> = {
  0: [
    { id: "ring", emoji: "💍", name: "CP Yüzüğü", price: 50000, c1: "#FBCFE8", c2: "#BE185D", tier: "epic" },
    { id: "pistol", emoji: "🔫", name: "Altın Tabanca", price: 10000, c1: "#FDE68A", c2: "#B45309", tier: "rare" },
    { id: "watch", emoji: "⌚", name: "Altın Saat", price: 10000, c1: "#FDE68A", c2: "#92400E", tier: "rare" },
    { id: "em", emoji: "💎", name: "Zümrüt Yüzük", price: 30000, c1: "#6EE7B7", c2: "#047857", tier: "epic" },
    { id: "bag", emoji: "🎁", name: "Şanslı Paket", price: 50000, c1: "#FCA5A5", c2: "#B91C1C", tier: "epic" },
    { id: "throne", emoji: "🦁", name: "Aslan Tahtı", price: 100000, c1: "#FDE68A", c2: "#B45309", tier: "legendary" },
    { id: "space", emoji: "🚀", name: "Yıldızlararası", price: 100000, c1: "#A5B4FC", c2: "#3730A3", tier: "legendary" },
    { id: "eiffel", emoji: "🗼", name: "Romantik Eyfel", price: 300000, c1: "#DDD6FE", c2: "#6D28D9", tier: "legendary" },
  ],
  1: [
    { id: "rose", emoji: "🌹", name: "Tek Gül", price: 520, c1: "#FDA4AF", c2: "#9F1239", tier: "normal" },
    { id: "heart", emoji: "❤️", name: "Kalp", price: 1314, c1: "#FCA5A5", c2: "#BE185D", tier: "normal" },
    { id: "kiss", emoji: "💋", name: "Öpücük", price: 1990, c1: "#FDA4AF", c2: "#9F1239", tier: "rare" },
    { id: "bouquet", emoji: "💐", name: "Gül Buketi", price: 9999, c1: "#FBCFE8", c2: "#BE185D", tier: "rare" },
    { id: "cprings", emoji: "💞", name: "Çift Yüzük", price: 13140, c1: "#F9A8D4", c2: "#9D174D", tier: "epic" },
    { id: "teddy", emoji: "🧸", name: "Aşk Ayıcığı", price: 20000, c1: "#FCD9B6", c2: "#92400E", tier: "epic" },
    { id: "cupid", emoji: "💘", name: "Aşk Oku", price: 52000, c1: "#FDA4AF", c2: "#BE185D", tier: "epic" },
    { id: "wedding", emoji: "💒", name: "Düğün Sarayı", price: 520000, c1: "#FBCFE8", c2: "#9D174D", tier: "legendary" },
  ],
  2: [
    { id: "clover", emoji: "🍀", name: "Şanslı Yonca", price: 1000, c1: "#6EE7B7", c2: "#047857", tier: "normal" },
    { id: "dice", emoji: "🎲", name: "Zar", price: 5000, c1: "#FCA5A5", c2: "#B91C1C", tier: "normal" },
    { id: "slot", emoji: "🎰", name: "Slot", price: 20000, c1: "#FDE68A", c2: "#B45309", tier: "rare" },
    { id: "gembox", emoji: "💝", name: "Sürpriz Kutu", price: 30000, c1: "#F9A8D4", c2: "#BE185D", tier: "epic" },
  ],
  3: [
    { id: "wheel", emoji: "🎡", name: "Çark", price: 8000, c1: "#A5B4FC", c2: "#3730A3", tier: "rare" },
    { id: "star", emoji: "🌟", name: "Yıldız Yağmuru", price: 60000, c1: "#FDE68A", c2: "#B45309", tier: "epic" },
  ],
  4: [
    { id: "crown", emoji: "👑", name: "Kral Tacı", price: 200000, c1: "#FDE68A", c2: "#92400E", tier: "legendary" },
    { id: "castle", emoji: "🏰", name: "Altın Kale", price: 500000, c1: "#FDE68A", c2: "#B45309", tier: "legendary" },
    { id: "car", emoji: "🏎️", name: "Spor Araba", price: 888000, c1: "#FCA5A5", c2: "#B91C1C", tier: "legendary" },
  ],
  5: [
    { id: "cpheart", emoji: "💑", name: "CP Bağ", price: 33000, c1: "#F9A8D4", c2: "#9D174D", tier: "epic" },
    { id: "forever", emoji: "♾️", name: "Sonsuz Aşk", price: 131400, c1: "#FBCFE8", c2: "#BE185D", tier: "legendary" },
  ],
  6: [
    { id: "galaxy", emoji: "🌌", name: "Galaksi", price: 999000, c1: "#A5B4FC", c2: "#3730A3", tier: "legendary" },
    { id: "phoenix", emoji: "🔥", name: "Anka Kuşu", price: 666000, c1: "#FCA5A5", c2: "#B91C1C", tier: "legendary" },
  ],
};
