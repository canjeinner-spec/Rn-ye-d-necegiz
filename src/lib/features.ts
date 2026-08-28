/**
 * Arayüz bayrakları.
 *
 * MVP lansmanı için bir süre kapalı tutulan bölümler 28 Ağustos 2026'da
 * kullanıcı isteğiyle AÇILDI. Ekranlar/rotalar zaten yerindeydi, yalnızca
 * girişleri gizliydi.
 *
 * ⚠️ ÖNEMLİ — AÇIK ama HENÜZ SAHTE olanlar:
 * Aşağıdaki bölümlerin ekranları tasarım olarak hazır ama **hiçbir DB
 * bağlantısı yok** (`src/data/remote/*Repo.ts` kullanmıyorlar) ve arkalarında
 * tablo da yok. Yani görünürler, gezilebilirler, ama gerçek bir iş yapmazlar:
 *
 *   store / vip / inventory      → sabit ürün listeleri; satın alma yok
 *   agency-panel (yayıncı)       → sabit kazanç/ajans sayıları
 *   gift-history                 → sabit geçmiş
 *   friends / events             → data/friends.ts, data/events.ts (sabit)
 *   rank sekmesi                 → data/seed.ts'teki RANKS/AGENCY_RANKS/
 *                                  STREAMER_RANKS (sabit)
 *   hediye gönderme (roomGift /
 *   dmGift / profileGift)        → animasyon oynar ama BAKİYE DÜŞMEZ,
 *                                  alıcıya bir şey geçmez, kayıt tutulmaz
 *   giftCoupon                   → kupon doğrulaması yok
 *
 * GERÇEK olan: `visitors` (visitRepo) ve `notifications` (Faz 3).
 *
 * Bunları gerçeğe bağlamak için sırasıyla gerekenler: hediye kataloğu +
 * gönderim RPC'si (bakiyeden düşen, atomik), envanter tablosu, ajans/yayıncı
 * tabloları, sıralama görünümleri (materialized view + zamanlanmış yenileme).
 */
export const FEATURES = {
  /** Oda alt barındaki hediye ikonu (hediye gönderme) */
  roomGift: true,
  /** Profil menüsündeki "Yayıncı Paneli" (yayıncı merkezi) girişi */
  streamerPanel: true,
  /** Profil menüsündeki "Hediye Geçmişi" girişi */
  giftHistory: true,
  /** Profil menüsündeki "Hediye Kuponu Gir" girişi */
  giftCoupon: true,
  /** Profildeki "Mağaza" tile'ı */
  store: true,
  /** Profil menüsündeki "Aron VIP" girişi */
  vip: true,
  /** Alt navigasyondaki "Sıralama" sekmesi */
  rankTab: true,
  /** Profildeki "Eşyalarım" (envanter) tile'ı */
  inventory: true,
  /** DM'deki "Arkadaşlık" kısayolu */
  friends: true,
  /** DM'deki "Etkinlik" kısayolu */
  events: true,
  /** DM'deki "Bildirim" kısayolu (gerçek — Faz 3) */
  notifications: true,
  /** DM'deki "Ziyaretçi" kısayolu (gerçek — visitRepo) */
  visitors: true,
  /** Başkasının profilindeki "Hediye" bölümü (Hediye Gönder) */
  profileGift: true,
  /** DM sohbet kutusundaki hediye butonu */
  dmGift: true,
} as const;
