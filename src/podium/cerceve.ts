import type { ImageSourcePropType } from "react-native";

export type CerceveKod = "altin" | "gumus" | "bronz";

/**
 * Çerçevedeki dairesel açıklığın yeri ve boyu — hepsi ORAN (0-1), piksel değil.
 * Çerçeve hangi boyda çizilirse çizilsin avatar aynı yere oturuyor.
 *
 * Bu değerler ELLE YAZILMAZ: `node scripts/cerceve-hazirla.js <sayfa.png>`
 * görselin içindeki açıklığı ölçüp aşağıdaki bloğu yeniden yazıyor. Göz kararı
 * hizalamak, çerçeve her değiştiğinde yeniden ayar demekti.
 *
 *   merkezX/merkezY — açıklığın merkezi (görselin genişliğine/yüksekliğine oran)
 *   capOran         — açıklığın çapı (görselin GENİŞLİĞİNE oran)
 *   enBoy           — görselin en/boy oranı; yükseklik buradan hesaplanıyor
 */
export type CerceveOlcu = { merkezX: number; merkezY: number; capOran: number; enBoy: number };

/* URETILEN-BLOK-BASI */
export const CERCEVE_OLCU: Record<CerceveKod, CerceveOlcu> = {
  altin: { merkezX: 0.4989, merkezY: 0.5577, capOran: 0.5483, enBoy: 0.8577 },
  gumus: { merkezX: 0.4979, merkezY: 0.5047, capOran: 0.5503, enBoy: 0.8983 },
  bronz: { merkezX: 0.4989, merkezY: 0.4755, capOran: 0.5892, enBoy: 1.0021 },
};
/* URETILEN-BLOK-SONU */

const GORSEL: Record<CerceveKod, ImageSourcePropType> = {
  altin: require("@/assets/podium/cerceve-altin.webp"),
  gumus: require("@/assets/podium/cerceve-gumus.webp"),
  bronz: require("@/assets/podium/cerceve-bronz.webp"),
};

/** Podyum sahnesi — salon arkaplanı. */
export const SAHNE: ImageSourcePropType = require("@/assets/podium/sahne.jpg");

export const cerceveGorsel = (kod: CerceveKod): ImageSourcePropType => GORSEL[kod];

/** Derece → çerçeve. Dördüncüden sonrası çerçevesiz. */
export const DERECE_CERCEVE: Record<number, CerceveKod> = { 1: "altin", 2: "gumus", 3: "bronz" };
