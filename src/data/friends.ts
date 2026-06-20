/**
 * Arkadaşlar — arkadasliklar (durum: kabul/beklemede).
 */
export type Friend = { name: string; lv: number; online: boolean; last: string };
export type FriendReq = { name: string; lv: number; note?: string; when: string };

export const FRIEND_LIST: Friend[] = [
  { name: "Mervee", lv: 38, online: true, last: "Çevrimiçi" },
  { name: "Zeno Sv.", lv: 42, online: true, last: "Çevrimiçi" },
  { name: "Lunas", lv: 33, online: false, last: "2 saat önce" },
  { name: "Ardaowski", lv: 51, online: true, last: "Çevrimiçi" },
  { name: "Melis", lv: 29, online: false, last: "Dün" },
  { name: "Furkan", lv: 24, online: false, last: "3 gün önce" },
];

export const FRIEND_REQS: FriendReq[] = [
  { name: "Rüya", lv: 36, note: "Selam! Tanışalım mı?", when: "1 saat önce" },
  { name: "Ender", lv: 21, note: "Odada görüştük, ekliyorum 🙌", when: "Dün" },
];
