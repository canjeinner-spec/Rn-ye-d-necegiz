import type LottieView from "lottie-react-native";
import type { ComponentProps } from "react";

/**
 * Hediye sahne manifesti — id (katalogdaki `kod`) → animasyon + ses + süre.
 *
 * ANIMASYON LOTTIE. Eskiden `svga` alanı vardı ve boştu; SVGA native player
 * gerektirdiği için hiç kullanılamadı. Lottie Expo Go'da çalışıyor.
 *
 * ── İKİ KURAL, İKİSİ DE ÖLÇÜLMÜŞ ACIDAN GELİYOR ────────────────────────────
 *
 * 1) `anim` BİR FONKSİYON, hazır kaynak değil. Eskiden `require(...)` doğrudan
 *    bu nesnenin içindeydi; nesne modül tepesinde kurulduğu için JSON'ların
 *    TAMAMI uygulama açılırken ayrıştırılıyordu — hiç hediye gönderilmese
 *    bile. Artık `anim()` çağrılana kadar hiçbiri açılmıyor. Metro `require`'ı
 *    yine statik görüyor, dosya pakete giriyor; ertelenen AYRIŞTIRMA maliyeti.
 *
 * 2) BURASI YALNIZ TAM EKRAN İÇİN. Izgara karosu, sohbet satırı ve profil
 *    vitrini Lottie DEĞİL, statik PNG kullanıyor (`giftPng.ts`; görseller
 *    `scripts/lottie-png.js` ile bu aynı dosyalardan üretiliyor). Sebebi
 *    ölçüldü: duruk kare (`ilerleme`) çizim döngüsünü durduruyor ama katman
 *    ağacını YİNE kuruyor, altı karo aynı anda ekranda olunca ızgara akıcı
 *    olmuyordu. Buradaki animasyonlar sadece gönderim efektinde ve büyük
 *    önizlemede kuruluyor — ekranda tek ve tam boy.
 *
 * SES: `sound` alanı `require(...)` ile bir ses dosyası bekliyor. Yeni ses
 * eklemek için dosyayı `assets/gifts/` içine koyup buraya bağlamak yeterli —
 * `BigGiftOverlay` ve `GiftFx` onu kendisi çalıyor (`expo-audio`, sessiz
 * modda da çalar).
 */
export type LottieKaynak = ComponentProps<typeof LottieView>["source"];

export type GiftScene = {
  /**
   * Lottie kaynağını İSTENDİĞİNDE üretir. ÇAĞIRMAK JSON'u ayrıştırır —
   * varlığını sınamak için çağırma, `animVar(id)` kullan.
   */
  anim?: () => LottieKaynak;
  /** `expo-audio` ile çalınacak ses. */
  sound?: number;
  /** Efektin ekranda kalma süresi (ms). */
  duration: number;
};

/**
 * Hediye sesleri URETILDI, indirilmedi — `scripts/hediye-sesi-uret.js`.
 * Sebep: indirilen bir dosya dinlenmeden yalnizca adina bakilarak secilirdi,
 * ayrica uygulama markete cikacak ve uretilen ses tamamen bize ait (lisans
 * takibi ve atif yukumlulugu yok). Begenilmeyen sesi degistirmek o betikte
 * birkac sayi.
 */
const SES = {
  gul: require("../../assets/gifts/gul.wav"),
  kedi: require("../../assets/gifts/kedi.wav"),
  ayicik: require("../../assets/gifts/ayicik.wav"),
  tavsan: require("../../assets/gifts/tavsan.wav"),
  kaplan: require("../../assets/gifts/kaplan.wav"),
  noel: require("../../assets/gifts/noel.wav"),
  hazine: require("../../assets/gifts/hazine.wav"),
};

/** Kendi sesi olmayan efsanevi hediyeler icin ortak ses. */
export const LEGENDARY_SOUND = require("../../assets/gifts/legendary.wav");

/**
 * Lottie dosyaları `src/anim/gifts/` altında ve KENDİ RENKLERİNDE bırakıldı.
 * Boş durum/yükleniyor animasyonları temaya boyanıyor (`scripts/lottie-boya.js`)
 * ama hediyeler öyle değil: gül kırmızı, hazine altın, ayıcık kahverengi
 * olmalı. Altına çevirmek hepsini aynı ve tanınmaz yapardı.
 *
 * DOSYA SEÇERKEN: katman sayısına bak, bayta değil. Kaldırılan "Zafer Gecesi"
 * 334 katman + 55 efekt + 30 blend mode'du; lottie-android efekt ve blend
 * mode'ların çoğunu yok sayıyor, o yüzden renkleri bozuk çiziliyordu.
 * Buradaki altı dosyanın en karmaşığında 5 repeater var, hepsi temiz.
 */
export const GIFT_SCENES: Record<string, GiftScene> = {
  ayicik: { anim: () => require("../anim/gifts/ayicik.json"), duration: 4530, sound: SES.ayicik }, //  99 KB
  kedi:   { anim: () => require("../anim/gifts/kedi.json"),   duration: 6000, sound: SES.kedi },   // 148 KB
  kaplan: { anim: () => require("../anim/gifts/kaplan.json"), duration: 6000, sound: SES.kaplan }, // 173 KB
  hazine: { anim: () => require("../anim/gifts/hazine.json"), duration: 3600, sound: SES.hazine }, // 180 KB
  gul:    { anim: () => require("../anim/gifts/gul.json"),    duration: 4000, sound: SES.gul },    // 258 KB
  // 959 KB ama 30 katman ve sıfır özel özellik: çizmesi ucuz.
  tavsan: { anim: () => require("../anim/gifts/tavsan.json"), duration: 2000, sound: SES.tavsan }, // 959 KB

  /**
   * KARE DİZİSİ — vektör değil, Lottie kılığına girmiş bir video: 24 fps'te
   * 97 kare, her katman bir gömülü görsel ve tam 1 kare yaşıyor, aynı anda
   * ekranda hep tek katman var. Çizmesi ucuz (kare başına tek bitmap) ama
   * BELLEK pahalı: lottie-android çözdüğü bitmap'leri kompozisyon boyunca
   * tutuyor. Özgün hâli 800x800'dü ve ~237 MB ediyordu — orta seviye
   * Android'de çökme demek. `scripts/lottie-gorsel-kucult.js` ile 256'ya
   * indirildi: ~24 MB. Zemini de o betik sildi (kaynak WebP'lerde alfa yoktu,
   * koyu temada beyaz kutu olarak çıkıyordu).
   */
  noel:   { anim: () => require("../anim/gifts/noel.json"),   duration: 4040, sound: SES.noel },   // 1357 KB

  // Efsanevi hediyeler için varsayılan (Lottie'si olmayan).
  _legendary: { sound: LEGENDARY_SOUND, duration: 3600 },
};

export const sceneFor = (id: string): GiftScene => GIFT_SCENES[id] ?? GIFT_SCENES._legendary;

/** Bu hediyenin Lottie'si var mı? JSON'u AYRIŞTIRMAZ. */
export const animVar = (id: string): boolean => !!GIFT_SCENES[id]?.anim;
