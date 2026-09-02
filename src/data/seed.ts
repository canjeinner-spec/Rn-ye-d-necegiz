import { type RoomBadgeItem } from "@/components/RoomBadges";
import { type SceneKind } from "@/components/Scene";
import { C } from "@/theme/colors";

export type Room = {
  /** odayi kuran kullanicinin id'si (kullanicilar.id) — sahip eslemesi isimle degil bununla yapilir */
  ownerId?: number;
  id: string;
  name: string;
  host: string;
  online: number;
  mic: number;
  extra: number;
  live: boolean;
  scene: SceneKind;
  official?: boolean;
  locked?: boolean;
  pass?: string;
  owner?: boolean;
  crowd: string[];
  photo?: string;
  announce?: string; // odalar.aciklama (oda duyurusu)
  badges?: RoomBadgeItem[];
  friends?: number;
  daily?: number;
  dbId?: number; // odalar.id (gerçek DB odası). Yoksa mock oda.
  createdAt?: number; // odalar.olusturulma_tarihi — "Yeni" sekmesi bunu sıralar
  // 054: yönetici bu odaya işlem yaptı mı (girişte uyarı, sahibe düzenleme kilidi)
  islemGordu?: boolean;
  islemSebep?: string;
};

export type Seat = {
  /** kullanicilar.id — emoji tepkisini doğru koltuğa düşürmek için */
  uid?: number;
  name: string;
  muted: boolean;
  lv: number;
  ring?: string;
  mod?: boolean;
  host?: boolean;
  speaking?: boolean;
  photo?: string;
  publicId?: string;
  /** Kuşanılan çerçeve teması (056) — koltukta çizilir. */
  cerceve?: string | null;
  /** Bu kişi platform yöneticisi mi — koltukta yetki rozeti çıkar. */
  yetki?: boolean;
};

/** Sohbete düşen hediye satırı — kim, kime, ne, kaç tane. */
export type HediyeSatiri = { emoji: string; ad: string; adet: number; kime: string; renk: string };

export type ChatMsg = { name: string; time: string; text: string; mod?: boolean; host?: boolean; myOwn?: boolean; photo?: string; uid?: number; publicId?: string; sys?: "mesaj" | "uyari"; baslik?: string; hediye?: HediyeSatiri;
  /** Yazan platform yoneticisi mi. Rozet, BAKANIN degil YAZANIN yetkisini
   *  gosterdigi icin mesajla birlikte tasiniyor. */
  yetki?: boolean };

export type DM = {
  name: string;
  kind?: "official" | "system";
  last: string;
  time: string;
  unread: number;
  online: boolean;
  official?: boolean;
  system?: boolean;
};

export const ROOMS: Room[] = [
  { id: "100000", name: "Aron Karşılama Odası", host: "Aron", online: 342, mic: 8, extra: 318, live: true, scene: "official", official: true, crowd: ["Ardaowski", "Mervee", "Zeno Sv.", "Lunas", "Ender"], friends: 6, badges: [{ type: "room_owner" }, { type: "lv", n: 29 }, { type: "weekly_champion" }, { type: "legendary" }, { type: "popular" }] },
  { id: "145632", name: "EĞLENECEKSEN GEL 🔥", host: "Mervee", online: 126, mic: 8, extra: 73, live: true, scene: "club", daily: 1, crowd: ["Mervee", "Zeno Sv.", "Lunas", "Ender", "Furkan"], friends: 4, badges: [{ type: "hot_streak" }, { type: "lv", n: 18 }, { type: "energy_star" }, { type: "event_master" }, { type: "popular" }] },
  { id: "145901", name: "ERKEKLER GELMESİN 💅", host: "Lunas", online: 94, mic: 6, extra: 56, live: true, scene: "lounge", locked: true, pass: "1234", crowd: ["Lunas", "Melis", "Rüya", "Mervee", "Zeno Sv."], friends: 3, badges: [{ type: "popular" }, { type: "lv", n: 12 }, { type: "spring_bloom" }, { type: "loyal_member" }] },
  { id: "146114", name: "UYKUM YOK 🌙", host: "Zeno Sv.", online: 81, mic: 7, extra: 48, live: true, scene: "night", daily: 2, crowd: ["Zeno Sv.", "Furkan", "Ender", "Melis", "Rüya"], friends: 2, badges: [{ type: "lv", n: 9 }, { type: "night_owl" }, { type: "chat_master" }, { type: "legendary" }] },
  { id: "146380", name: "YAKINDA ❤️", host: "Rüya", online: 0, mic: 0, extra: 32, live: false, scene: "fire", crowd: ["Rüya", "Melis", "Lunas", "Mervee", "Ender"], friends: 5, badges: [{ type: "hot_streak" }, { type: "rank_silver" }, { type: "lv", n: 21 }, { type: "rising_star" }] },
];

export const SEATS: Seat[] = [
  { name: "Mervee", muted: true, lv: 38 },
  { name: "Zeno Sv.", muted: true, lv: 41, ring: C.gold, mod: true },
  { name: "Lunas", muted: true, lv: 29 },
  { name: "Ender", muted: true, lv: 33 },
  { name: "Furkan", muted: true, lv: 26 },
  { name: "Ardaowski", muted: false, lv: 99, speaking: true, host: true },
  { name: "Melis", muted: true, lv: 22 },
  { name: "Rüya", muted: true, lv: 31 },
];

export const CHAT0: ChatMsg[] = [
  { name: "Zeno Sv.", time: "21:47", text: "PUAHAHAHAHS", mod: true },
  { name: "Mervee", time: "21:47", text: "ben koptum yaa 😂😂" },
  { name: "Lunas", time: "21:47", text: "iyi geldiniz herkeseee 💜" },
  { name: "Ender", time: "21:48", text: "geç kaldık yine 😅" },
  { name: "Ardaowski", time: "21:48", host: true, text: "hoş geldiniz arkadaşlar, keyifli sohbetler 🎉" },
];

export const DMS: DM[] = [
  { name: "Aron", kind: "official", last: '"Samimi değilsen uzak ol!" etkinliği başlamak üzere', time: "Cuma 20:58", unread: 0, online: true, official: true },
  { name: "Sistem", kind: "system", last: "Üye rozetin grileşti", time: "20/05 21:00", unread: 0, online: true, system: true },
  { name: "Mervee", last: "Odaya gelsene, konuşalım biraz 🎀", time: "21:48", unread: 2, online: true },
  { name: "Zeno Sv.", last: "Akşam yayın var mı?", time: "21:45", unread: 1, online: true },
  { name: "Lunas", last: "Tamamdır, bekliyorum seni ✨", time: "21:43", unread: 0, online: true },
  { name: "Ender", last: "Sesli odan çok keyifli yaa 🔥", time: "21:40", unread: 0, online: true },
  { name: "Furkan", last: "Yarın birlikte yayın açalım mı?", time: "21:38", unread: 0, online: false },
  { name: "Rüya", last: "İyi geceler, görüşürüz 💜", time: "21:35", unread: 0, online: false },
  { name: "Melis", last: "Teşekkürler 🙏", time: "21:30", unread: 0, online: true },
];

/*
 * Sıralama listeleri buradaydı (RANKS / AGENCY_RANKS / STREAMER_RANKS).
 * Kaldırıldı: gerçek kullanıcıya uydurma şampiyon göstermek yanlış.
 * Zenginlik/Cazibe/Odalar artık 060_siralama.sql'den geliyor
 * (data/remote/siralamaRepo.ts); ajans ve yayıncı sekmeleri dürüst boş
 * durum gösteriyor — o tablolar temel şemada var ama henüz hiç kayıt yok.
 */

