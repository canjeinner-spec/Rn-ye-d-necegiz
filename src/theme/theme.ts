/**
 * Semantik renk katmanı.
 *
 * Ham hex/rgba değerleri bileşenlerde doğrudan kullanılmaz; bunun yerine
 * buradaki anlamsal token'lar (colors.primary, colors.textSecondary, ...)
 * kullanılır. Tek kaynak `colors.ts` içindeki `C` paletidir — burada sadece
 * o palete anlam (rol) atanır.
 */
import { C } from "./colors";

export const colors = {
  /** Marka / vurgu rengi (altın). */
  primary: C.gold,
  primaryLight: C.gold2,

  /** Zeminler. */
  background: C.bg,
  surface: C.card,
  surfaceAlt: C.card2,

  /** Metin hiyerarşisi. */
  textPrimary: C.text,
  textSecondary: C.dim,
  textTertiary: C.dim2,
  /** Koyu zemin üstünde maksimum kontrast başlık. */
  textInverse: "#FFFFFF",

  /** Çizgiler / ayırıcılar. */
  divider: C.line,
  border: "rgba(255,255,255,.06)",
  borderStrong: "rgba(255,255,255,.12)",

  /** Durum renkleri. */
  live: C.purple,
  liveDeep: "#6D28D9",
  success: C.green,
  danger: C.red,
  equalizer: "#F59E0B",

  /** Katmanlar / örtüler. */
  overlay: "rgba(0,0,0,.55)",
  scrim: "rgba(255,255,255,.08)",
} as const;

/** Çoklu renkli (gradient) token'lar. */
export const gradients = {
  live: ["#8B5CF6", "#6D28D9"] as const,
  tierDaily: ["#3A2A66", "#221A42"] as const,
  tierOfficial: ["#1E2A52", "#162038"] as const,
} as const;

export type ColorToken = keyof typeof colors;
