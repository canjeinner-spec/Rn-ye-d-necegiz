import { GIFTS, type Gift } from "./gifts";

/**
 * Hediye geçmişi — hediye_loglari (alinan/gonderilen).
 */
export type GiftLogRow = { gid: string; qty: number; when: string; today?: boolean; from?: string; to?: string };

export const GIFT_LOG: { received: GiftLogRow[]; sent: GiftLogRow[] } = {
  received: [
    { gid: "throne", from: "Mervee", qty: 1, when: "14:32", today: true },
    { gid: "rose", from: "Zeno Sv.", qty: 99, when: "13:10", today: true },
    { gid: "heart", from: "Lunas", qty: 10, when: "11:48", today: true },
    { gid: "em", from: "Ardaowski", qty: 1, when: "Dün 22:05" },
    { gid: "kiss", from: "Ender", qty: 5, when: "Dün 20:14" },
    { gid: "watch", from: "Furkan", qty: 1, when: "Dün 18:40" },
    { gid: "rose", from: "Rüya", qty: 20, when: "2 gün önce" },
    { gid: "bag", from: "Melis", qty: 1, when: "2 gün önce" },
  ],
  sent: [
    { gid: "rose", to: "Mervee", qty: 50, when: "15:01", today: true },
    { gid: "heart", to: "Lunas", qty: 5, when: "12:22", today: true },
    { gid: "clover", to: "Furkan", qty: 10, when: "Dün 19:33" },
    { gid: "dice", to: "Zeno Sv.", qty: 3, when: "Dün 17:08" },
    { gid: "slot", to: "Ardaowski", qty: 1, when: "3 gün önce" },
  ],
};

export const GIFT_BY_ID: Record<string, Gift> = Object.values(GIFTS)
  .flat()
  .reduce((a, g) => { a[g.id] = g; return a; }, {} as Record<string, Gift>);
