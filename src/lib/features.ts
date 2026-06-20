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
} as const;
