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
 *    bu nesnenin içindeydi; nesne modül tepesinde kurulduğu için 7 JSON'un
 *    TAMAMI (~6.3 MB) uygulama açılırken ayrıştırılıyordu — hiç hediye
 *    gönderilmese bile. Artık `anim()` çağrılana kadar hiçbiri açılmıyor.
 *    Metro `require`'ı yine statik görüyor, yani dosya pakete giriyor;
 *    ertelenen şey AYRIŞTIRMA maliyeti.
 *
 * 2) `agir` işaretli hediyeler KÜÇÜK YERLERDE ÇİZİLMEZ. Lottie'nin pahalı
 *    kısmı oynatma değil, kompozisyonu KURMAK: 334 katmanlık bir sahne
 *    30 piksellik sohbet satırında da 30 piksellik maliyet vermiyor, tam
 *    maliyet veriyor. Duruk kare (`ilerleme`) çizim döngüsünü durduruyor
 *    ama katman ağacını yine kuruyor — o yüzden yetmedi. Ağır hediyeler
 *    ızgarada/sohbette/vitrinde emojiye düşer, Lottie yalnız tam ekran
 *    efektte ve büyük önizlemede kurulur.
 *
 *    ÖLÇÜT DOSYA BOYUTU DEĞİL, KARMAŞIKLIK. İlk denemede tavşan (959 KB)
 *    salt boyutuna bakılarak ağır sayıldı ve emojiye düştü; oysa 30 katmanı
 *    var ve tek bir desteklenmeyen özelliği yok — çizmesi ucuz, maliyeti
 *    yalnız bir kerelik ayrıştırma. Karar katman sayısına ve efekt/blend
 *    mode/matte yüküne bakar. Şu an ağır işaretli dosya YOK — tek örnek
 *    olan zafer katalogdan çıkarıldı (086).
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
  /**
   * Dosya küçük yerlerde kurulamayacak kadar ağır (~300 KB üstü ya da
   * yüzlerce katman). Izgara/sohbet/vitrin emojiye düşer.
   */
  agir?: boolean;
};

export const LEGENDARY_SOUND = require("../../assets/gifts/legendary.wav");

/**
 * Lottie dosyaları `src/anim/gifts/` altında ve KENDİ RENKLERİNDE bırakıldı.
 * Boş durum/yükleniyor animasyonları temaya boyanıyor (`scripts/lottie-boya.js`)
 * ama hediyeler öyle değil: gül kırmızı, hazine altın, ayıcık kahverengi
 * olmalı. Altına çevirmek hepsini aynı ve tanınmaz yapardı.
 *
 * Yanlarındaki boyutlar `agir` kararının dayanağı — dosya değiştirirsen
 * boyutu da güncelle.
 */
export const GIFT_SCENES: Record<string, GiftScene> = {
  // ── hafif: her yerde çizilebilir ─────────────────────────────────────────
  ayicik: { anim: () => require("../anim/gifts/ayicik.json"), duration: 4530 },              //  99 KB
  kedi:   { anim: () => require("../anim/gifts/kedi.json"),   duration: 6000 },              // 148 KB
  kaplan: { anim: () => require("../anim/gifts/kaplan.json"), duration: 6000 },              // 173 KB
  hazine: { anim: () => require("../anim/gifts/hazine.json"), duration: 3600, sound: LEGENDARY_SOUND }, // 180 KB
  gul:    { anim: () => require("../anim/gifts/gul.json"),    duration: 4000 },              // 258 KB

  // 959 KB ama 30 katman ve sıfır özel özellik: çizmesi ucuz, ağır DEĞİL.
  tavsan: { anim: () => require("../anim/gifts/tavsan.json"), duration: 2000 },              // 959 KB

  // Şu an ağır işaretli hediye YOK. Bayrak ve `kucukKaynak` bilerek duruyor:
  // zafer (4.6 MB, 334 katman) tam olarak bunun için eklenmişti ve kaldırıldı;
  // mekanizma dursun ki bir dahaki ağır dosyada aynı acı yaşanmasın.

  // Efsanevi hediyeler için varsayılan (Lottie'si olmayan).
  _legendary: { sound: LEGENDARY_SOUND, duration: 3600 },
};

export const sceneFor = (id: string): GiftScene => GIFT_SCENES[id] ?? GIFT_SCENES._legendary;

/** Bu hediyenin Lottie'si var mı? JSON'u AYRIŞTIRMAZ. */
export const animVar = (id: string): boolean => !!GIFT_SCENES[id]?.anim;

/**
 * Izgara karosu, sohbet satırı, vitrin gibi KÜÇÜK yerlerde Lottie kurulabilir
 * mi? Ağır dosyalarda `false` — çağıran emojiye düşmeli.
 */
export const kucukteCizilir = (id: string): boolean => {
  const s = GIFT_SCENES[id];
  return !!s?.anim && !s.agir;
};

/**
 * Küçük yerler için kaynak: uygunsa JSON'u yükler, ağırsa `undefined`.
 * Tam ekran efekt bunu KULLANMAZ, doğrudan `sceneFor(id).anim?.()` çağırır.
 */
export const kucukKaynak = (id: string): LottieKaynak | undefined =>
  kucukteCizilir(id) ? GIFT_SCENES[id].anim!() : undefined;
