/**
 * Bildirimler — bildirimler (tip/baslik/icerik/veri/okundu).
 * kategori: UI gruplaması (sistem/etkinlik/sosyal). ikon/renk sunum için türetilir.
 */
export type BildirimKategori = "sistem" | "etkinlik" | "sosyal";

export type BildirimItem = {
  id: number;
  kategori: BildirimKategori;
  tip: string;
  ikon: string;
  renk: string;
  baslik: string;
  icerik: string;
  zaman: string;
  okunmadi: boolean;
  aksiyon?: string;
};

export const NOTIF_TABS: [BildirimKategori | "all", string][] = [
  ["all", "Tümü"],
  ["sistem", "Sistem"],
  ["etkinlik", "Etkinlik"],
  ["sosyal", "Sosyal"],
];

export const NOTIFS: BildirimItem[] = [
  { id: 1, kategori: "sistem", tip: "level", ikon: "⬆️", renk: "#22D3EE", baslik: "Seviye Atladın!", icerik: "Tebrikler, LV.12'ye ulaştın. Yeni profil çerçevesinin kilidi açıldı.", zaman: "5 dk önce", okunmadi: true },
  { id: 2, kategori: "etkinlik", tip: "event", ikon: "🏆", renk: "#F5CE6E", baslik: "Sultan'ın Tahtı başladı", icerik: "Onur savaşı etkinliği başladı! Listede ilk 30'a gir, ödülleri kap.", zaman: "1 sa önce", okunmadi: true, aksiyon: "Etkinliğe Git" },
  { id: 3, kategori: "sosyal", tip: "follow", ikon: "💜", renk: "#A855F7", baslik: "Yeni takipçi", icerik: "Mervee seni takip etmeye başladı.", zaman: "2 sa önce", okunmadi: true },
  { id: 4, kategori: "sistem", tip: "gift", ikon: "🎁", renk: "#34D399", baslik: "Hediye geldi", icerik: "Lunas sana 'Spor Araba' gönderdi (×1).", zaman: "3 sa önce", okunmadi: false },
  { id: 5, kategori: "sosyal", tip: "mention", ikon: "💬", renk: "#60A5FA", baslik: "Bahsedildi", icerik: "Ender bir odada senden bahsetti.", zaman: "Dün", okunmadi: false },
  { id: 6, kategori: "sistem", tip: "badge", ikon: "🏅", renk: "#FB7185", baslik: "Üye Rozeti", icerik: "30 gün giriş yapmadığın için üye rozetin grileşti.", zaman: "Dün", okunmadi: false },
  { id: 7, kategori: "etkinlik", tip: "event", ikon: "⚽", renk: "#6EE7B7", baslik: "Futbol Şampiyonası", icerik: "Oda içi futbol etkinliği yayında. Arkadaşlarınla maç yap.", zaman: "2 gün önce", okunmadi: false, aksiyon: "Detaylar" },
];
