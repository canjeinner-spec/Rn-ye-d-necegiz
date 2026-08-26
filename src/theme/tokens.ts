/**
 * ARON CHAT ölçü token'ları — 4dp ızgara.
 *
 * Neden var: ekranlar tek tek elle ölçüldüğü için boşluk/punto/yarıçap
 * değerleri birbirini tutmuyordu (13.5 punto, 11 boşluk, 13 yarıçap gibi
 * rastgele sayılar). Rozetlerin kayık, sekmelerin farklı boyutta durmasının
 * sebebi buydu. Artık ölçüler buradan gelir.
 *
 * Kural: yeni kod bu token'ları kullanır. Ara değer gerekiyorsa önce
 * "gerçekten gerekli mi" diye sor — %95 ihtimalle komşu token yeterli.
 *
 * Renkler `colors.ts` (C), fontlar `fonts.ts` (Font) içinde — burası
 * yalnızca ÖLÇÜ.
 */

/** Boşluk: margin, padding, gap. 4dp ızgara. */
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Köşe yarıçapı. `pill` = tam yuvarlak (buton/çip). */
export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * Yazı puntosu. `Txt` bileşenine `size={T.body}` gibi verilir.
 *   caption → rozet sayısı, çok küçük etiket
 *   small   → zaman damgası, yardımcı metin
 *   body    → liste açıklaması, ikincil metin
 *   text    → varsayılan gövde, liste başlığı
 *   title   → ekran başlığı, kart başlığı
 *   h2/h1   → vurgulu başlıklar
 */
export const T = {
  caption: 10,
  small: 11,
  body: 12,
  text: 14,
  title: 16,
  h2: 18,
  h1: 22,
} as const;

/** İkon boyutu (Icon bileşeni `size` prop'u). */
export const I = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/**
 * Sık kullanılan bileşen ölçüleri — aynı şeyin her ekranda farklı
 * boyutta çizilmesini engeller.
 */
export const SZ = {
  /** Başlıktaki geri/aksiyon butonu (kare) */
  iconBtn: 36,
  /** Liste satırındaki avatar */
  avatarRow: 40,
  /** Çip/sekme yüksekliği */
  chip: 32,
  /** Buton yüksekliği */
  button: 44,
  /** Okunmadı noktası */
  dot: 8,
  /** Avatar üzerindeki küçük tür rozeti */
  miniBadge: 20,
} as const;
