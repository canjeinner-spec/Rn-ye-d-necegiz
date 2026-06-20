/**
 * Mağaza çerçeveleri — store_frames / cerceveler tablosu ile uyumlu.
 */
export type StoreFrameCat = "standart" | "vip" | "yayinci";

export type StoreFrame = {
  id: string;
  name: string;
  cat: StoreFrameCat;
  coins: number;
  usd?: number;
  desc: string;
};

export const STORE_FRAMES: StoreFrame[] = [
  { id: "gumus", name: "Gümüş Halkası", cat: "standart", coins: 150, desc: "Dönen gümüş daire" },
  { id: "neon_mavi", name: "Neon Mavi", cat: "standart", coins: 350, desc: "Elektrik mavi glow" },
  { id: "mor_sis", name: "Mor Sis", cat: "standart", coins: 600, desc: "Süzülen mor partiküller" },
  { id: "altin_tac", name: "Altın Taç", cat: "vip", coins: 1800, desc: "Altın dönen taç" },
  { id: "kizil", name: "Kızıl Fırtına", cat: "vip", coins: 3200, desc: "Çift kor kıvılcım halkası" },
  { id: "obsidyen", name: "Obsidyen", cat: "vip", coins: 5500, desc: "Karanlık + altın parıltı" },
  { id: "yesil_dalga", name: "Yeşil Dalga", cat: "yayinci", coins: 4000, usd: 3.99, desc: "EQ dalga efekti" },
  { id: "mor_lazer", name: "Mor Lazer", cat: "yayinci", coins: 6500, usd: 5.99, desc: "Lazer ışın halkası" },
  { id: "altin_yayin", name: "Altın Yayın", cat: "yayinci", coins: 9999, usd: 8.99, desc: "Broadcast konsantrik" },
];
