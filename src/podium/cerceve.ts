import type { ImageSourcePropType } from "react-native";

/**
 * Podyum çerçeveleri İKİ SET:
 *   daire — kişi sıralamaları (avatar yuvarlak)
 *   kare  — oda sıralaması (oda kapakları kare üretiliyor; daireye sokmak
 *           kapağın kenarlarını kırpıyor, referansta da odalar kare)
 */
export type CerceveKod = "altin" | "gumus" | "bronz" | "kare-altin" | "kare-gumus" | "kare-bronz";

/**
 * Çerçevedeki açıklığın yeri ve boyu — hepsi ORAN (0-1), piksel değil.
 * Çerçeve hangi boyda çizilirse çizilsin avatar aynı yere oturuyor.
 *
 * Bu değerler ELLE YAZILMAZ: `node scripts/cerceve-hazirla.js <sayfa.png>`
 * görselin içindeki açıklığı ölçüp aşağıdaki blokları yeniden yazıyor. Göz
 * kararıyla hizalamak, çerçeve her değiştiğinde yeniden ayar demekti.
 *
 *   merkezX/merkezY — açıklığın merkezi (görselin genişliğine/yüksekliğine oran)
 *   capOran         — açıklığın çapı / kare kenarı (görselin GENİŞLİĞİNE oran)
 *   enBoy           — görselin en/boy oranı; yükseklik buradan hesaplanıyor
 */
export type CerceveOlcu = { merkezX: number; merkezY: number; capOran: number; enBoy: number };

/* URETILEN-BLOK-BASI */
const DAIRE_OLCU: Record<string, CerceveOlcu> = {
  altin: { merkezX: 0.498, merkezY: 0.5698, capOran: 0.317, enBoy: 1.0338 },
  gumus: { merkezX: 0.4989, merkezY: 0.5702, capOran: 0.3277, enBoy: 1.0064 },
  bronz: { merkezX: 0.498, merkezY: 0.5546, capOran: 0.3189, enBoy: 1.0852 },
};
/* URETILEN-BLOK-SONU */

/* URETILEN-KARE-BLOK-BASI */
const KARE_OLCU: Record<string, CerceveOlcu> = {
  "kare-altin": { merkezX: 0.499, merkezY: 0.5595, capOran: 0.2779, enBoy: 1.048 },
  "kare-gumus": { merkezX: 0.4979, merkezY: 0.559, capOran: 0.2947, enBoy: 1.0193 },
  "kare-bronz": { merkezX: 0.5, merkezY: 0.543, capOran: 0.2895, enBoy: 1.1145 },
};
/* URETILEN-KARE-BLOK-SONU */

export const CERCEVE_OLCU = { ...DAIRE_OLCU, ...KARE_OLCU } as Record<CerceveKod, CerceveOlcu>;

/**
 * Görseller. KARE SET HENÜZ YOK: dosyalar gelince aşağıdaki üç satırın yorumu
 * kaldırılacak ve `KARE_HAZIR` true yapılacak. `require` var olmayan dosyada
 * paketlemeyi patlattığı için satırlar şimdiden açık bırakılamıyor.
 */
const GORSEL: Partial<Record<CerceveKod, ImageSourcePropType>> = {
  altin: require("@/assets/podium/cerceve-altin.webp"),
  gumus: require("@/assets/podium/cerceve-gumus.webp"),
  bronz: require("@/assets/podium/cerceve-bronz.webp"),
  "kare-altin": require("@/assets/podium/cerceve-kare-altin.webp"),
  "kare-gumus": require("@/assets/podium/cerceve-kare-gumus.webp"),
  "kare-bronz": require("@/assets/podium/cerceve-kare-bronz.webp"),
};

/** Kare set hazır mı? Görseller eklenince true. */
export const KARE_HAZIR = true;

/**
 * Rakam (1/2/3) çerçeve sanatının PARÇASI mı?
 *
 * Referans uygulamada rakam metale kabartılmış, sonradan yazılmamış. Yeni set
 * öyle üretiliyor; geldiğinde bu bayrak true olacak ve ekran kendi madalyonunu
 * çizmeyi bırakacak. Şimdiki set rakamsız, o yüzden madalyon hâlâ gerekiyor.
 */
export const CERCEVEDE_RAKAM = true;

/** Podyum sahnesi — salon arkaplanı. */
export const SAHNE: ImageSourcePropType = require("@/assets/podium/sahne.jpg");

const DAIRE_SIRA: Record<number, CerceveKod> = { 1: "altin", 2: "gumus", 3: "bronz" };
const KARE_SIRA: Record<number, CerceveKod> = { 1: "kare-altin", 2: "kare-gumus", 3: "kare-bronz" };

/**
 * Derece → çerçeve kodu. Oda sıralaması kare seti kullanıyor; set hazır
 * değilse daire setine düşüyor ki ekran çalışmayı sürdürsün.
 */
export function dereceCercevesi(derece: number, tur: "kisi" | "oda" = "kisi"): CerceveKod {
  if (tur === "oda" && KARE_HAZIR) return KARE_SIRA[derece] ?? "kare-bronz";
  return DAIRE_SIRA[derece] ?? "bronz";
}

/** Açıklık kare mi — kapak ona göre kırpılıyor. */
export const kareMi = (kod: CerceveKod): boolean => kod.startsWith("kare-");

export const cerceveGorsel = (kod: CerceveKod): ImageSourcePropType | undefined => GORSEL[kod];
