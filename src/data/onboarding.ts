import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";

export type Ulke = { code: string; flag: string; name: string };

/** Açılış ekranındaki Weplay tarzı tanıtım karuseli slaytları. */
export type IntroSlide = { icon: IconName; title: string; desc: string; accent: string };

export const INTRO_SLIDES: IntroSlide[] = [
  { icon: "mic", title: "Sesli odalara katıl", desc: "Koltuğa otur, mikrofonu al, sohbetin ortasında ol.", accent: C.purple2 },
  { icon: "gift", title: "Hediyelerle parla", desc: "Sevdiklerine hediye gönder, sahneyi renklendir.", accent: C.gold2 },
  { icon: "trophy", title: "Sıralamada yüksel", desc: "Puan topla, seviye atla, gecenin yıldızı ol.", accent: C.teal2 },
];

export const COUNTRIES: Ulke[] = [
  { code: "+90", flag: "🇹🇷", name: "Türkiye" },
  { code: "+49", flag: "🇩🇪", name: "Almanya" },
  { code: "+44", flag: "🇬🇧", name: "İngiltere" },
  { code: "+1", flag: "🇺🇸", name: "ABD" },
  { code: "+33", flag: "🇫🇷", name: "Fransa" },
  { code: "+31", flag: "🇳🇱", name: "Hollanda" },
  { code: "+7", flag: "🇷🇺", name: "Rusya" },
  { code: "+994", flag: "🇦🇿", name: "Azerbaycan" },
  { code: "+971", flag: "🇦🇪", name: "BAE" },
];

// Demo: kayıtlı numaralar → doğrudan giriş; diğerleri → kayıt formu
export const REGISTERED_PHONES = ["5321440788", "5551234567"];

/**
 * Kayıt ekranındaki "hazır avatarlar".
 *
 * pravatar.cc ÇIKARILDI: üçüncü taraf bir demo servisiydi ve HER YENİ
 * KULLANICIYA gösteriliyordu — yani mağazaya çıkacak uygulamanın kayıt
 * akışı dışarıya bağımlıydı, ağ yoksa kutular boş kalıyordu.
 *
 * Yerine kendi Storage kovamızdaki URL'ler gelecek (görsel YÜKLEME canlıda
 * yapılacak, koddan yapılamaz). Liste boşken bölüm hiç çizilmiyor; kullanıcı
 * kendi fotoğrafını yükleyebiliyor ve yüklemezse `Portrait` adından
 * üretilmiş avatarı çiziyor — akış kırılmıyor.
 */
export const PRESET_AVATARS: string[] = [];
