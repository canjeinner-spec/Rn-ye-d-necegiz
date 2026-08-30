import { type IconName } from "@/icons/paths";

/**
 * Eşya görselleri — 056'daki `esyalar.tema` anahtarının istemci karşılığı.
 *
 * Hiçbir asset yok: giriş efektleri ve sohbet balonları burada tarif edilen
 * renk/ikon/parçacık ayarlarıyla çiziliyor. Yeni eşya eklemek = SQL'e bir
 * satır + buraya bir tema. (Çerçeveler ayrı: components/FramePreview.)
 */

export type GirisTema = {
  ikon: IconName;
  /** Şerit gradyanı */
  g1: string;
  g2: string;
  /** Parçacık rengi */
  parca: string;
  /** Parçacık sayısı — ağır efektlerde daha çok */
  adet: number;
  /** Girişte yazan cümle ("<ad> ...") */
  cumle: string;
};

export const GIRIS_TEMALARI: Record<string, GirisTema> = {
  yildiz:       { ikon: "evStar",    g1: "#4C1D95", g2: "#1E1B4B", parca: "#C4B5FD", adet: 14, cumle: "yıldız tozuyla geldi" },
  kalp:         { ikon: "evHeart",   g1: "#9D174D", g2: "#3B0764", parca: "#FBCFE8", adet: 12, cumle: "kalplerle geldi" },
  konfeti:      { ikon: "evParty",   g1: "#7C2D12", g2: "#1E1B4B", parca: "#FCD34D", adet: 18, cumle: "konfetilerle geldi" },
  dalga:        { ikon: "bars",      g1: "#065F46", g2: "#0F172A", parca: "#6EE7B7", adet: 10, cumle: "ses dalgasıyla geldi" },
  kar:          { ikon: "evDiamond", g1: "#0C4A6E", g2: "#0F172A", parca: "#E0F2FE", adet: 16, cumle: "kar taneleriyle geldi" },
  simsek:       { ikon: "bolt",      g1: "#1E3A8A", g2: "#0B1120", parca: "#93C5FD", adet: 8,  cumle: "şimşek gibi girdi" },
  alev:         { ikon: "flame",     g1: "#7F1D1D", g2: "#1C1917", parca: "#FB923C", adet: 14, cumle: "alevlerle girdi" },
  kanat:        { ikon: "wing",      g1: "#1E293B", g2: "#0F172A", parca: "#F1F5F9", adet: 12, cumle: "kanatlarını açtı" },
  meteor:       { ikon: "flame",     g1: "#431407", g2: "#0C0A09", parca: "#FCD34D", adet: 12, cumle: "meteor gibi düştü" },
  araba:        { ikon: "car",       g1: "#78350F", g2: "#0C0A09", parca: "#FDE68A", adet: 10, cumle: "gaza basarak geldi" },
  altin_yagmur: { ikon: "evDiamond", g1: "#78350F", g2: "#1C1917", parca: "#F5CE6E", adet: 20, cumle: "altın yağmuruyla geldi" },
  taht:         { ikon: "crown",     g1: "#713F12", g2: "#1C1917", parca: "#FDE68A", adet: 22, cumle: "tahtıyla geldi" },
};

export type BalonTema = {
  /** Balon zemini */
  bg: string;
  kenar: string;
  yazi: string;
  /** Ad/etiket rengi */
  ad: string;
};

export const BALON_TEMALARI: Record<string, BalonTema> = {
  sade:      { bg: "rgba(255,255,255,.07)", kenar: "rgba(255,255,255,.14)", yazi: "#F4F2EE", ad: "#8E8C99" },
  altin:     { bg: "rgba(232,179,65,.13)",  kenar: "rgba(232,179,65,.40)",  yazi: "#FDF6E3", ad: "#F5CE6E" },
  okyanus:   { bg: "rgba(34,211,238,.12)",  kenar: "rgba(34,211,238,.38)",  yazi: "#ECFEFF", ad: "#67E8F9" },
  gul:       { bg: "rgba(244,114,182,.13)", kenar: "rgba(244,114,182,.38)", yazi: "#FDF2F8", ad: "#FBCFE8" },
  mor_neon:  { bg: "rgba(139,92,246,.15)",  kenar: "rgba(167,139,250,.45)", yazi: "#F5F3FF", ad: "#C4B5FD" },
  zumrut:    { bg: "rgba(16,185,129,.13)",  kenar: "rgba(52,211,153,.40)",  yazi: "#ECFDF5", ad: "#6EE7B7" },
  ates:      { bg: "rgba(249,115,22,.14)",  kenar: "rgba(251,146,60,.45)",  yazi: "#FFF7ED", ad: "#FDBA74" },
  buz:       { bg: "rgba(125,211,252,.13)", kenar: "rgba(186,230,253,.42)", yazi: "#F0F9FF", ad: "#BAE6FD" },
  galaksi:   { bg: "rgba(124,58,237,.16)",  kenar: "rgba(236,72,153,.42)",  yazi: "#FAF5FF", ad: "#F0ABFC" },
  kraliyet:  { bg: "rgba(180,83,9,.18)",    kenar: "rgba(253,224,71,.50)",  yazi: "#FEFCE8", ad: "#FDE68A" },
};

/** Nadirlik → renk/etiket (mağaza ve envanter rozetleri). */
export const NADIRLIK: Record<string, { ad: string; renk: string }> = {
  standart: { ad: "Standart", renk: "#8E8C99" },
  nadir:    { ad: "Nadir",    renk: "#60A5FA" },
  epik:     { ad: "Epik",     renk: "#A78BFA" },
  efsane:   { ad: "Efsane",   renk: "#F5CE6E" },
};
