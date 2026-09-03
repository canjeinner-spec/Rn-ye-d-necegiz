/**
 * Arayüz bayrakları.
 *
 * MVP lansmanı için bir süre kapalı tutulan bölümler 28 Ağustos 2026'da
 * kullanıcı isteğiyle AÇILDI. Ekranlar/rotalar zaten yerindeydi, yalnızca
 * girişleri gizliydi.
 *
 * DURUM — neyin arkasında gerçek veri var (30 Ağustos 2026):
 *
 *   GERÇEK
 *     store / inventory          → esyaRepo (056): satın alma altını düşürür,
 *                                  kuşanılan çerçeve/balon/giriş odada çalışır
 *     hediye gönderme (roomGift) → hediyeRepo (059): temel şemadaki
 *                                  hediye_gonder tetikleyicisi; komisyon %30
 *     dmGift / profileGift       → hediyeRepo (3 Eylül): profil ve DM'den
 *                                  gönderim gerçekten bakiyeden düşüyor
 *     agency-panel (yayıncı)     → hediye_gecmisi'nden saatlik/günlük kazanç
 *     rank sekmesi               → siralamaRepo (060): zenginlik/cazibe/odalar
 *     görevler + günlük giriş    → gorevRepo (061): ilerleme sunucuda türetilir
 *     visitors, notifications, odam sekmeleri, oda listesi
 *
 *   HÂLÂ SAHTE / BAĞLANMAMIŞ
 *     vip                        → sabit paket listesi
 *     gift-history               → sabit geçmiş
 *     friends / events           → data/friends.ts, data/events.ts (sabit)
 *     giftCoupon                 → kupon doğrulaması yok
 *     withdraw                   → akış ve tasarım duruyor, GERÇEK DEĞİL:
 *                                  rakamlar sabit örnek, çekim talebi
 *                                  withdrawal_requests'e yazılmıyor.
 *                                  4 Eylül: sahte "Çekim tamamlandı" ekranı
 *                                  kaldırıldı, ekran artık doğruyu söylüyor
 *     diamond-load               → satın alma YOK (expo-iap + dev build
 *                                  gerekiyor, Faz 4.11). 4 Eylül: sahte
 *                                  "Satın alma başarılı" ekranı kaldırıldı
 *     ajans / yayıncı sıralaması → tablolar duruyor, tek kayıt yok
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
