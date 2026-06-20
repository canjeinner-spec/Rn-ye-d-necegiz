/**
 * Ziyaretçiler — profil_ziyaretleri (ziyaretci/zaman).
 */
export type Visitor = { name: string; lv: number; when: string; today: boolean; vip: boolean; gender: "e" | "k" };

export const VISITORS: Visitor[] = [
  { name: "Mervee", lv: 38, when: "5 dk önce", today: true, vip: true, gender: "k" },
  { name: "Zeno Sv.", lv: 42, when: "22 dk önce", today: true, vip: false, gender: "e" },
  { name: "Ardaowski", lv: 51, when: "1 saat önce", today: true, vip: true, gender: "e" },
  { name: "Lunas", lv: 33, when: "3 saat önce", today: true, vip: false, gender: "k" },
  { name: "Furkan", lv: 24, when: "Dün 23:10", today: false, vip: false, gender: "e" },
  { name: "Melis", lv: 29, when: "Dün 21:42", today: false, vip: true, gender: "k" },
  { name: "Ender", lv: 21, when: "Dün 19:05", today: false, vip: false, gender: "e" },
  { name: "Rüya", lv: 36, when: "2 gün önce", today: false, vip: false, gender: "k" },
];
