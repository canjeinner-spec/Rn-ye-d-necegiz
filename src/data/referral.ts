/**
 * Arkadaşını davet et — referanslar / referans_odulleri.
 */
export type RefFriend = { name: string; lv: number; when: string; reward: number; done: boolean };
export type RefTier = { n: number; reward: number; label: string };

export const REF_FRIENDS: RefFriend[] = [
  { name: "Furkan", lv: 24, when: "2 gün önce", reward: 50, done: true },
  { name: "Melis", lv: 29, when: "5 gün önce", reward: 50, done: true },
  { name: "Ender", lv: 21, when: "1 hafta önce", reward: 50, done: true },
];

export const REF_TIERS: RefTier[] = [
  { n: 1, reward: 50, label: "İlk davet" },
  { n: 5, reward: 500, label: "5 arkadaş" },
  { n: 10, reward: 1500, label: "10 arkadaş" },
  { n: 25, reward: 5000, label: "25 arkadaş" },
];
