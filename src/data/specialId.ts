/**
 * Özel ID — ozel_idler (tier/durum) + zenginler sıralaması.
 */
export type SpecialTier = "super" | "t1" | "t2";

export const SPECIAL_ID_DATA: Record<SpecialTier, { gold: string; ids: string[] }> = {
  super: { gold: "36M", ids: ["11111", "22222", "33333", "44444", "55555", "66666", "77777", "88888", "99999"] },
  t1: { gold: "18M", ids: ["999999", "888888", "666666", "333333"] },
  t2: { gold: "9M", ids: ["222224", "111110", "777772", "555552"] },
};

export const tierLabel = (t: SpecialTier) =>
  t === "super" ? "Süper Özel ID" : t === "t1" ? "1. Seviye Özel ID" : "2. Seviye Özel ID";

export const tierBadgeColor = (t: SpecialTier) =>
  t === "super" ? "#E8B341" : t === "t1" ? "#EF4444" : "#3B82F6";

export type ThroneEntry = { id: string; name: string };
export const THRONE_SUPER: ThroneEntry = { id: "11111", name: "Ardaowski" };
export const THRONE_T2: ThroneEntry[] = [
  { id: "333330", name: "Mervee" },
  { id: "111110", name: "Zeno Sv." },
  { id: "666665", name: "Lunas" },
  { id: "666999", name: "Ender" },
];

// ─────────────────────────────────────────────────────────────────────────────
// ÖZEL ID GÖRSEL HİYERARŞİSİ (kullanıcının kuralı — basamak sayısına göre)
//
//   • 5 basamak ve altı  (100, 8888, 54321)  → PREMIUM KART
//        Süslü ÖZEL ID kartı (25 tema) verilir; ID metni kartın üzerine yazılır.
//        Hangi temanın verileceğini ADMİN atar (otomatik değil).
//   • 6–7 basamak         (123456, 1234567)   → KAPSÜL
//        Süslü çerçeve yok; ID rakamı premium bir "ID kapsülü"nün içine alınır.
//   • 8 ve üzeri                               → DÜZ numara, özel görünüm yok.
//
// Eşikler tek yerde — değiştirmesi kolay.
export const OZEL_ID_KART_MAX = 5;
export const OZEL_ID_KAPSUL_MAX = 7;

// 25 premium ÖZEL ID kart teması (assets/badges/idcard/<key>.png ile birebir).
export const OZEL_ID_KARTLARI = [
  "bronze", "silver", "gold", "platinum", "diamond",
  "legendary", "mythic", "celestial", "void", "emerald",
  "pearl", "ice", "dragon", "shadow", "cyber",
  "royal", "demon", "holy", "futuristic", "nature",
  "samurai", "pirate", "steampunk", "music", "star",
] as const;
export type OzelIdKart = (typeof OZEL_ID_KARTLARI)[number];

// title = İngilizce (kart üstü), sub = Türkçe alt açıklama.
export const OZEL_ID_KART_ADI: Record<OzelIdKart, { title: string; sub: string }> = {
  bronze: { title: "ÖZEL ID BRONZE", sub: "Bronz Kimlik" },
  silver: { title: "ÖZEL ID SILVER", sub: "Gümüş Kimlik" },
  gold: { title: "ÖZEL ID GOLD", sub: "Altın Kimlik" },
  platinum: { title: "ÖZEL ID PLATINUM", sub: "Platin Kimlik" },
  diamond: { title: "ÖZEL ID DIAMOND", sub: "Elmas Kimlik" },
  legendary: { title: "ÖZEL ID LEGENDARY", sub: "Efsanevi Kimlik" },
  mythic: { title: "ÖZEL ID MYTHIC", sub: "Mistik Kimlik" },
  celestial: { title: "ÖZEL ID CELESTIAL", sub: "Göksel Kimlik" },
  void: { title: "ÖZEL ID VOID", sub: "Boşluk Kimlik" },
  emerald: { title: "ÖZEL ID EMERALD", sub: "Zümrüt Kimlik" },
  pearl: { title: "ÖZEL ID PEARL", sub: "İnci Kimlik" },
  ice: { title: "ÖZEL ID ICE", sub: "Buz Kimlik" },
  dragon: { title: "ÖZEL ID DRAGON", sub: "Ejderha Kimlik" },
  shadow: { title: "ÖZEL ID SHADOW", sub: "Gölge Kimlik" },
  cyber: { title: "ÖZEL ID CYBER", sub: "Siber Kimlik" },
  royal: { title: "ÖZEL ID ROYAL", sub: "Kraliyet Kimlik" },
  demon: { title: "ÖZEL ID DEMON", sub: "Şeytan Kimlik" },
  holy: { title: "ÖZEL ID HOLY", sub: "Kutsal Kimlik" },
  futuristic: { title: "ÖZEL ID FUTURISTIC", sub: "Gelecek Kimlik" },
  nature: { title: "ÖZEL ID NATURE", sub: "Doğa Kimlik" },
  samurai: { title: "ÖZEL ID SAMURAI", sub: "Samuray Kimlik" },
  pirate: { title: "ÖZEL ID PIRATE", sub: "Korsan Kimlik" },
  steampunk: { title: "ÖZEL ID STEAMPUNK", sub: "Buhar Kimlik" },
  music: { title: "ÖZEL ID MUSIC", sub: "Müzik Kimlik" },
  star: { title: "ÖZEL ID STAR", sub: "Yıldız Kimlik" },
};

export type OzelIdTier = "kart" | "kapsul" | "none";

/** Sadece rakam basamaklarını sayar (harf/işaret hariç). */
export function idBasamak(id: string | null | undefined): number {
  if (!id) return 0;
  return id.replace(/\D/g, "").length;
}

/** ID'nin hangi görsel katmana düştüğü (kart / kapsül / düz). */
export function ozelIdTier(id: string | null | undefined): OzelIdTier {
  const n = idBasamak(id);
  if (n === 0) return "none";
  if (n <= OZEL_ID_KART_MAX) return "kart";
  if (n <= OZEL_ID_KAPSUL_MAX) return "kapsul";
  return "none";
}
