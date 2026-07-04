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

// Her temanın imza rengi — kapsül "birebir uyumlu renk" için (light→dark gradyan
// + accent kenar/amblem). Kart çerçeveleri çoğunlukla altın olduğundan otomatik
// örnekleme yerine tema adına göre elle ayarlandı (daha ayırt edici/temiz).
export const OZEL_ID_TEMA_RENK: Record<OzelIdKart, { g: [string, string]; accent: string; ink: string }> = {
  bronze: { g: ["#C77B3B", "#7A431C"], accent: "#E7A063", ink: "#FFEBD6" },
  silver: { g: ["#AEBBCC", "#5C6B80"], accent: "#D6E0EC", ink: "#0E1620" },
  gold: { g: ["#F5C24A", "#A9720C"], accent: "#FFE29A", ink: "#3A2600" },
  platinum: { g: ["#9CC3DE", "#4E7699"], accent: "#D3EAF6", ink: "#0C1B26" },
  diamond: { g: ["#B57BE0", "#6D34A6"], accent: "#E3C6F6", ink: "#1B0A2A" },
  legendary: { g: ["#B26BD6", "#6A3AA0"], accent: "#F0D08A", ink: "#1B0A2A" },
  mythic: { g: ["#FF8A3C", "#B3400E"], accent: "#FFC58A", ink: "#3A1400" },
  celestial: { g: ["#EAD9A0", "#B79A55"], accent: "#FFF3CF", ink: "#2A2208" },
  void: { g: ["#7A3FCF", "#3A1670"], accent: "#C79BF0", ink: "#170830" },
  emerald: { g: ["#2CC79A", "#127254"], accent: "#9BEBCF", ink: "#04241A" },
  pearl: { g: ["#EAAFCB", "#B36A90"], accent: "#FBE0EE", ink: "#2E1020" },
  ice: { g: ["#4FB3EC", "#1C6AA8"], accent: "#B9E4FB", ink: "#06202E" },
  dragon: { g: ["#D19A2A", "#8A5B12"], accent: "#F3CE7A", ink: "#2E1D00" },
  shadow: { g: ["#6C6488", "#332C4A"], accent: "#A7A0C0", ink: "#100C1C" },
  cyber: { g: ["#C24BE0", "#6E24A0"], accent: "#F0A6F6", ink: "#22062A" },
  royal: { g: ["#8A5CD0", "#4A2C90"], accent: "#CBB0F0", ink: "#16082A" },
  demon: { g: ["#E0463A", "#8A1810"], accent: "#F6A69B", ink: "#2E0605" },
  holy: { g: ["#F3DE9A", "#C0A24E"], accent: "#FFF6D4", ink: "#2E2608" },
  futuristic: { g: ["#3FC0D8", "#1E6E96"], accent: "#AEEAF6", ink: "#04222C" },
  nature: { g: ["#83B83E", "#4A7220"], accent: "#CBE9A0", ink: "#122A06" },
  samurai: { g: ["#C24A2E", "#7A2812"], accent: "#F0A68A", ink: "#2A0A04" },
  pirate: { g: ["#B85B2E", "#722F12"], accent: "#E7A063", ink: "#2A1206" },
  steampunk: { g: ["#B0803F", "#6E4A1C"], accent: "#E0BB80", ink: "#2A1B06" },
  music: { g: ["#D94BC4", "#8A2480"], accent: "#F6A6E6", ink: "#2A0624" },
  star: { g: ["#8A6BD8", "#4A3596"], accent: "#F0D08A", ink: "#16082A" },
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
