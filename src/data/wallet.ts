/**
 * Cüzdan verisi — wallet_ledger / balance_lots / cuzdanlar ile uyumlu.
 */
export type LedgerBirim = "altin" | "diamond" | "usd";

export type LedgerTx = {
  id: number;
  tip: "gift_in" | "gift_out" | "purchase" | "convert" | "promo" | "withdraw";
  yon: "in" | "out";
  birim: LedgerBirim;
  tutar: number;
  baslik: string;
  alt: string;
  date: string;
};

export const WALLET_LEDGER: LedgerTx[] = [
  { id: 1, tip: "gift_in", yon: "in", birim: "diamond", tutar: 520, baslik: "Hediye geldi · Mervee", alt: "Spor Araba", date: "Bugün 21:40" },
  { id: 2, tip: "purchase", yon: "in", birim: "altin", tutar: 35000, baslik: "Altın satın alındı", alt: "App Store · $24.99", date: "Bugün 18:02" },
  { id: 3, tip: "gift_out", yon: "out", birim: "altin", tutar: -50000, baslik: "Hediye gönderildi · Lunas", alt: "CP Yüzüğü ×1", date: "Dün 23:15" },
  { id: 4, tip: "convert", yon: "out", birim: "diamond", tutar: -200, baslik: "Elmas → Altın", alt: "2.000 altın alındı", date: "Dün 14:22" },
  { id: 5, tip: "promo", yon: "in", birim: "altin", tutar: 100, baslik: "Günlük giriş ödülü", alt: "Promosyon", date: "Dün 09:10" },
  { id: 6, tip: "withdraw", yon: "out", birim: "usd", tutar: -50, baslik: "Para çekme talebi", alt: "İnceleniyor", date: "2 gün önce" },
];

export const LEDGER_ICON: Record<LedgerTx["tip"], { e: string; c: string }> = {
  gift_in: { e: "🎁", c: "#34D399" },
  gift_out: { e: "🎁", c: "#F472B6" },
  purchase: { e: "💳", c: "#FBBF24" },
  convert: { e: "🔄", c: "#22D3EE" },
  promo: { e: "🎉", c: "#A78BFA" },
  withdraw: { e: "🏦", c: "#FB7185" },
};

// Elmas paketleri — elmas_paketleri tablosu
export type ElmasPaket = { id: number; elmas: number; fiyat: number; bonus?: number; populer?: boolean };
export const ELMAS_PAKETLERI: ElmasPaket[] = [
  { id: 1, elmas: 60, fiyat: 0.99 },
  { id: 2, elmas: 300, fiyat: 4.99, bonus: 20 },
  { id: 3, elmas: 980, fiyat: 14.99, bonus: 80, populer: true },
  { id: 4, elmas: 1980, fiyat: 29.99, bonus: 260 },
  { id: 5, elmas: 3280, fiyat: 49.99, bonus: 600 },
  { id: 6, elmas: 6480, fiyat: 99.99, bonus: 1480 },
];
