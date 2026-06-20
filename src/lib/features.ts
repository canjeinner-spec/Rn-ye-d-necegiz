/**
 * MVP arayüz bayrakları.
 *
 * Bu öğeler MVP lansmanı için arayüzden GİZLENDİ; kodları/ekranları/rotaları
 * yerinde duruyor. İleride geri getirmek için ilgili bayrağı `true` yapman
 * yeterli — ekstra bir şey yapmana gerek yok.
 */
export const FEATURES = {
  /** Oda alt barındaki hediye ikonu (hediye gönderme) */
  roomGift: false,
  /** Profil menüsündeki "Yayıncı Paneli" (yayıncı merkezi) girişi */
  streamerPanel: false,
  /** Profil menüsündeki "Hediye Geçmişi" girişi */
  giftHistory: false,
  /** Profil menüsündeki "Hediye Kuponu Gir" girişi */
  giftCoupon: false,
  /** Profildeki "Mağaza" tile'ı */
  store: false,
  /** Profil menüsündeki "Aron VIP" girişi */
  vip: false,
  /** Alt navigasyondaki "Sıralama" sekmesi (rank ekranı sidebar'dan erişilir) */
  rankTab: false,
  /** Profildeki "Eşyalarım" (envanter) tile'ı */
  inventory: false,
  /** DM'deki "Arkadaşlık" kısayolu */
  friends: false,
  /** DM'deki "Etkinlik" kısayolu */
  events: false,
  /** DM'deki "Bildirim" kısayolu */
  notifications: false,
  /** DM'deki "Ziyaretçi" kısayolu (ekran profilden de açılır) */
  visitors: false,
  /** Başkasının profilindeki "Hediye" bölümü (Hediye Gönder) */
  profileGift: false,
  /** DM sohbet kutusundaki hediye butonu */
  dmGift: false,
} as const;
