import type LottieView from "lottie-react-native";
import type { ComponentProps } from "react";

/**
 * Hediye sahne manifesti — id (katalogdaki `kod`) → animasyon + ses + süre.
 *
 * ANIMASYON ARTIK LOTTIE. Eskiden burada `svga` alanı vardı ve boştu; SVGA
 * native player gerektirdiği için hiç kullanılamadı. Lottie ise Expo Go'da
 * çalışıyor (`lottie-react-native` Expo'nun paket listesinde), o yüzden
 * hediye efektleri gerçek animasyona bu yoldan geçti.
 *
 * SES: `sound` alanı `require(...)` ile bir ses dosyası bekliyor. Yeni ses
 * eklemek için dosyayı `assets/gifts/` içine koyup buraya `require` ile
 * bağlamak yeterli — `BigGiftOverlay` ve `GiftFx` onu kendisi çalıyor
 * (`expo-audio`, sessiz modda da çalar).
 */
export type GiftScene = {
  /** Ekranda oynayacak Lottie. Yoksa eski kodla çizilen efekt kullanılır. */
  anim?: ComponentProps<typeof LottieView>["source"];
  /** `expo-audio` ile çalınacak ses. */
  sound?: number;
  /** Efektin ekranda kalma süresi (ms). */
  duration: number;
};

export const LEGENDARY_SOUND = require("../../assets/gifts/legendary.wav");

/**
 * Lottie dosyaları `src/anim/gifts/` altında ve KENDİ RENKLERİNDE bırakıldı.
 * Boş durum/yükleniyor animasyonları temaya boyanıyor (`scripts/lottie-boya.js`)
 * ama hediyeler öyle değil: gül kırmızı, hazine altın, ayıcık kahverengi
 * olmalı. Altına çevirmek hepsini aynı ve tanınmaz yapardı.
 */
export const GIFT_SCENES: Record<string, GiftScene> = {
  gul:    { anim: require("../anim/gifts/gul.json"),    duration: 4000 },
  ayicik: { anim: require("../anim/gifts/ayicik.json"), duration: 4530 },
  kedi:   { anim: require("../anim/gifts/kedi.json"),   duration: 6000 },
  tavsan: { anim: require("../anim/gifts/tavsan.json"), duration: 2000 },
  kaplan: { anim: require("../anim/gifts/kaplan.json"), duration: 6000 },
  hazine: { anim: require("../anim/gifts/hazine.json"), sound: LEGENDARY_SOUND, duration: 3600 },

  /**
   * EN AĞIR VARLIK — 4.6 MB, 1440x1024, 10.67 sn, 60 fps, 334 katman.
   *
   * Dosya sınırımız (Anim.tsx) 100 KB; bu onun 25 katı ve bundle'ı tek
   * başına ~6.6 MB'dan ~11 MB'a çıkarıyor. Bilinçli kabul edildi: efsanevi
   * kademede tek bir gösteri parçası. AMA yeni büyük hediyeler pakete
   * GÖMÜLMEMELİ — hediyeler.animasyon_url kolonu ve Lottie'nin {uri}
   * kaynağı bunun için var, Storage'dan yüklenmeli.
   *
   * Cihazda kare düşerse ilk bakılacak yer burası.
   */
  zafer: { anim: require("../anim/gifts/zafer.json"), sound: LEGENDARY_SOUND, duration: 10670 },

  // Efsanevi hediyeler için varsayılan (Lottie'si olmayan).
  _legendary: { sound: LEGENDARY_SOUND, duration: 3600 },
};

export const sceneFor = (id: string): GiftScene => GIFT_SCENES[id] ?? GIFT_SCENES._legendary;

/** Bu hediyenin kendi Lottie animasyonu var mı? */
export const animVar = (id: string): boolean => !!GIFT_SCENES[id]?.anim;
