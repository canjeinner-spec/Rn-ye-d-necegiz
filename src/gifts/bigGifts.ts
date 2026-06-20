/**
 * Büyük (ekranı kaplayan) hediye sahne manifesti.
 * id → { sound, duration, svga? }
 *
 * NOT: Gerçek WePlay/Yalla kalitesinde SVGA/PAG dosyaları native player gerektirir
 * (dev-client). Bu yüzden `svga` alanı şimdilik boş; dev-client'a geçince
 * her sahneye .svga dosyası eklenip BigGiftOverlay içindeki renderer
 * <SvgaPlayer source={scene.svga}/> ile değiştirilecek. Manifest aynı kalır.
 */
export type GiftScene = {
  sound: number;
  duration: number;
  svga?: number;
};

export const LEGENDARY_SOUND = require("../../assets/gifts/legendary.wav");

export const GIFT_SCENES: Record<string, GiftScene> = {
  // tüm efsanevi hediyeler için varsayılan sahne
  _legendary: { sound: LEGENDARY_SOUND, duration: 3600 },
  // örnek: ileride giriş efektleri / özel hediyeler
  // car:   { sound: require("../../assets/gifts/car.wav"),   duration: 5200, svga: require("../../assets/gifts/car.svga") },
  // throne:{ sound: require("../../assets/gifts/throne.wav"), duration: 4200, svga: require("../../assets/gifts/throne.svga") },
};

export const sceneFor = (id: string): GiftScene => GIFT_SCENES[id] ?? GIFT_SCENES._legendary;
