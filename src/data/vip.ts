/**
 * Aron VIP — vip_kademeleri / vip_ayricaliklari ile uyumlu.
 */
export type VipTierKey = "asil" | "hukumdar";
export type VipTier = { name: string; color: string; grad: [string, string]; price: string; monthly: number; count: number };

/**
 * Kademe renkleri uygulamanın siyah-altın temasına göre:
 * Asil = bronz (giriş kademesi), Hükümdar = parlak altın (en üst).
 * Hükümdar eskiden mordu; tema dışıydı ve "üst kademe" hissi vermiyordu.
 */
export const VIP_TIERS: Record<VipTierKey, VipTier> = {
  asil: { name: "Asil", color: "#D9A05B", grad: ["#E0A45C", "#8A5A2B"], price: "₺299,99", monthly: 2100, count: 11 },
  hukumdar: { name: "Hükümdar", color: "#F5CE6E", grad: ["#FBE08C", "#C8922B"], price: "₺599,99", monthly: 4500, count: 14 },
};

export type VipPerk = { d: string; t: string; s: string };
export const VIP_PERKS: VipPerk[] = [
  { d: "M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-1.5 11h-15L3 8z", t: "VIP Rozeti", s: "Kademene özel prestij rozeti" },
  { d: "M3 12a9 9 0 0 1 9-9m6.5 2.5L21 3M15 9h6V3", t: "Görkemli Giriş", s: "Odaya göz kamaştırıcı efektle gir" },
  { d: "M4 7h16M4 12h10M4 17h7", t: "Renkli İsim", s: "İsmin gökkuşağı renginde parlar" },
  { d: "M4 5h16v14H4zM8 11l2 2 3-4 4 5H7z", t: "Resim Gönderme", s: "Odada fotoğraf paylaş" },
  { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10", t: "Özel Çerçeve", s: "VIP profil çerçeveleri" },
  { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6", t: "Gizli Mod", s: "Odaya görünmeden gir" },
  { d: "M2 12s3.5-7 10-7 10 7 10 7M12 9a3 3 0 100 6", t: "Ziyaretçiler", s: "Profilini kimler gezdi gör" },
  { d: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v3", t: "Mesaj Geri Al", s: "Gönderdiğin mesajı sil" },
  { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", t: "Özel Balon", s: "Mesajların özel baloncukla" },
  { d: "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z", t: "Hediye İndirimi", s: "Tüm hediyelerde %10 indirim" },
  { d: "M6 9H4.5a2.5 2.5 0 0 0 0 5H6m12-5h1.5a2.5 2.5 0 0 1 0 5H18M8 21h8M12 14v7M7 4h10v6a5 5 0 0 1-10 0z", t: "Sıralama Önceliği", s: "Listelerde öne çık" },
  { d: "M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z", t: "2x Deneyim", s: "Çift seviye puanı kazan" },
  { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01", t: "Özel Emojiler", s: "VIP'e özel emoji paketi" },
  { d: "M6 3h12l4 6-10 13L2 9z", t: "Aylık Elmas", s: "Her ay bonus elmas kazan" },
];
