/**
 * Envanter — kullanici_envanteri (item_id, tip, edinme/son_kullanma, aktif_mi).
 */
export type InvKategori = "frame" | "entry" | "bubble";

export type InvItem = { id: string; name: string; left: string; emoji?: string; c?: string };

export const INV_TABS: [InvKategori, string][] = [
  ["frame", "Çerçeveler"],
  ["entry", "Giriş Efekti"],
  ["bubble", "Sohbet Balonu"],
];

export const INVENTORY: Record<InvKategori, InvItem[]> = {
  frame: [
    { id: "gumus", name: "Gümüş Halkası", left: "Süresiz" },
    { id: "neon_mavi", name: "Neon Mavi", left: "23 gün" },
    { id: "altin_tac", name: "Altın Taç", left: "12 gün" },
    { id: "kizil", name: "Kızıl Fırtına", left: "5 gün" },
  ],
  entry: [
    { id: "e_araba", name: "Spor Araba Girişi", emoji: "🏎️", c: "#F5CE6E", left: "18 gün" },
    { id: "e_kanat", name: "Melek Kanadı", emoji: "🕊️", c: "#A5F3FC", left: "7 gün" },
    { id: "e_alev", name: "Alev Girişi", emoji: "🔥", c: "#FB7185", left: "Süresiz" },
  ],
  bubble: [
    { id: "b_altin", name: "Altın Baloncuk", emoji: "💬", c: "#F5CE6E", left: "30 gün" },
    { id: "b_mor", name: "Mor Neon", emoji: "💜", c: "#A855F7", left: "14 gün" },
  ],
};
