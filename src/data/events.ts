import { type IconName } from "@/icons/paths";

/**
 * Etkinlikler — etkinlikler (baslik/aciklama/durum/tarih).
 */
export type EventTag = "yayinda" | "yakinda" | "bitti";
export type EventItem = {
  id: number;
  title: string;
  desc: string;
  tag: EventTag;
  date: string;
  c1: string;
  c2: string;
  ic: IconName;
  featured?: boolean;
};

export const EVENTS: EventItem[] = [
  { id: 1, title: "Çifte Elmas Haftası", desc: "Tüm elmas paketlerinde %100 bonus! Bu haftaya özel yüklemelerinde iki katı elmas kazan.", tag: "yayinda", date: "11 Haz – 18 Haz", c1: "#22D3EE", c2: "#0E7490", ic: "evDiamond", featured: true },
  { id: 2, title: "Yıldız Yayıncı Yarışı", desc: "Haftanın en çok hediye alan yayıncısı 50.000 🪙 ödül kazanıyor.", tag: "yayinda", date: "9 Haz – 16 Haz", c1: "#F5CE6E", c2: "#B45309", ic: "trophy" },
  { id: 3, title: "Sevgi Festivali", desc: "Aşk temalı hediyeler %30 indirimli. CP yüzüğü hediye edene özel çerçeve!", tag: "yayinda", date: "14 Haz – 21 Haz", c1: "#F472B6", c2: "#BE185D", ic: "evHeart" },
  { id: 4, title: "Gece Sohbeti Maratonu", desc: "Gece 00:00–04:00 arası odalarda kal, ekstra tecrübe topla.", tag: "yakinda", date: "20 Haz başlıyor", c1: "#A855F7", c2: "#6D28D9", ic: "evMoon" },
  { id: 5, title: "Yeni Üye Şöleni", desc: "İlk kez katılanlara hoş geldin paketi: 500 elmas + 3 günlük VIP.", tag: "yakinda", date: "25 Haz başlıyor", c1: "#34D399", c2: "#059669", ic: "evParty" },
  { id: 6, title: "Ramazan Bereketi", desc: "Bağış yarışmasında ilk 10 oda rozetle ödüllendirildi.", tag: "bitti", date: "1 May – 30 May", c1: "#64748B", c2: "#334155", ic: "evStar" },
];

export const EV_TAGS: Record<EventTag, { t: string; c: string }> = {
  yayinda: { t: "Yayında", c: "#34D399" },
  yakinda: { t: "Yakında", c: "#60A5FA" },
  bitti: { t: "Bitti", c: "#94A3B8" },
};
