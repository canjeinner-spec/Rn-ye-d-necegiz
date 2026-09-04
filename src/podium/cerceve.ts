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
  altin: { merkezX: 0.4952, merkezY: 0.5517, capOran: 0.4429, enBoy: 0.8463 },
  gumus: { merkezX: 0.5011, merkezY: 0.5373, capOran: 0.4966, enBoy: 0.8745 },
  bronz: { merkezX: 0.5, merkezY: 0.5444, capOran: 0.5608, enBoy: 0.8808 },
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
