/**
 * ARON CHAT renk paleti — web mockup'taki `C` objesinden birebir taşındı.
 * Siyah-altın premium tema.
 */
export const C = {
  bg: "#08080C",
  card: "#131319",
  card2: "#17171F",
  line: "rgba(255,255,255,.07)",

  /**
   * YÜZEY KATLARI — ölçülerek çıkarıldı, uydurulmadı.
   *
   * Uygulamada aynı "beyaz üstü şeffaf yüzey" BEŞ farklı alfayla çiziliyordu
   * (.03 .035 .04 .045 .05 .06 .08). Bağlamlarına bakınca örtük bir hiyerarşi
   * olduğu görüldü ama adlandırılmamıştı:
   *   .05 → dokunulabilir kontroller (ikon düğmesi, sekme, çip)
   *   .04 → içerik kartları (istatistik kartı, kısayol)
   *   .08 → gruplanmış / öne çıkan yüzeyler (defter grubu, ayırıcı)
   * Aradaki .03 / .035 / .045 / .06 ise kayma: aynı işi yapan yerler farklı
   * yazılmış.
   *
   * Üç kata indirildi. Yeni yüzey yazarken elle rgba yazma, bunları kullan.
   */
  /** İçerik kartı — okunacak şeyin altındaki yüzey. */
  kart: "rgba(255,255,255,.04)",
  /** Dokunulabilir yüzey — düğme, sekme, çip. Karttan bir tık parlak. */
  kontrol: "rgba(255,255,255,.05)",
  /** Öne çıkan / gruplanmış yüzey — seçili durum, defter grubu. */
  kartUst: "rgba(255,255,255,.08)",
  gold: "#E8B341",
  gold2: "#F5CE6E",
  purple: "#8B5CF6",
  purple2: "#A78BFA",
  green: "#34D399",
  teal: "#5EEAD4",
  teal2: "#2DD4BF",
  red: "#F87171",
  text: "#F4F2EE",
  dim: "#8E8C99",
  dim2: "#5C5A66",
} as const;

export type ColorKey = keyof typeof C;
