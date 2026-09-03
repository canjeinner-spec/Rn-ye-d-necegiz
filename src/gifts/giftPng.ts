import type { ImageSourcePropType } from "react-native";

/**
 * Hediye karolarinin STATIK gorseli.
 *
 * NEDEN VAR: her Lottie ayri bir native gorunum ve kendi kompozisyon agaci.
 * Hediye kutusunda alti tanesi ayni anda duruyordu; duruk kare (`progress`)
 * cizim dongusunu durduruyor ama katman agacini YINE kuruyor, o yuzden
 * yetmedi — izgara akici olmadi, kullanicinin tarifiyle "native hissi 0".
 *
 * Karar (kullanici): "png gibi gosterelim, animasyon sadece atarken oynasin".
 * Rakiplerin (Yalla/WePlay) yaptigi da bu.
 *
 * URETIM: bu dosyalar ELLE cizilmedi, ayni Lottie'lerden uretildi —
 * `node scripts/lottie-png.js`. Betik kareyi de kayit altinda tutuyor
 * (tavsan 0.85, kalanlar 0.5), yani tekrar calistirinca ayni sonuc cikiyor.
 * Toplam 120 KB; ayni gorselleri Lottie olarak cizmek 1.8 MB JSON demekti.
 *
 * YENI HEDIYE EKLERKEN: json'u src/anim/gifts/ altina koy, betigi calistir,
 * asagiya bir satir ekle. Satir eklenmezse hediye sessizce emojiye duser.
 */
const PNG: Record<string, ImageSourcePropType> = {
  gul: require("../anim/gifts/png/gul.png"),
  kedi: require("../anim/gifts/png/kedi.png"),
  ayicik: require("../anim/gifts/png/ayicik.png"),
  tavsan: require("../anim/gifts/png/tavsan.png"),
  kaplan: require("../anim/gifts/png/kaplan.png"),
  hazine: require("../anim/gifts/png/hazine.png"),
};

/** Karo gorseli. Yoksa cagiran emojiye dusmeli. */
export const giftPng = (id?: string | null): ImageSourcePropType | undefined =>
  id ? PNG[id] : undefined;
