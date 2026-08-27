import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Font } from "@/theme/fonts";

/**
 * Premium ÖZEL ID çerçeveleri (24 adet).
 *
 * ESKİ SİSTEM: ID numarası görsele çizilmişti; kullanıcı "numarası hoşuna
 * giden" banner'ı seçiyordu. Üretim sırasında bazı rakam/harfler silinmiş
 * (ÖZEL D, 466_2), görseller de yarı saydam kaldığı için silik duruyordu.
 *
 * YENİ SİSTEM: çerçevelerin içi BOŞ; ID'yi uygulama yazıyor. Böylece
 *   • herkes istediği çerçeveyi kendi ID'siyle kullanabiliyor,
 *   • yazı hiçbir zaman bozulmuyor (vektör metin),
 *   • yeni çerçeve eklemek sadece dosya + iki satır.
 *
 * Her çerçevenin boş panelinin yeri FARKLI (x %34–47 arası). Bu yüzden
 * sabit bir oran kullanılamaz — panel dikdörtgeni her PNG'den piksel piksel
 * ölçülüp buraya oran olarak gömüldü. Yazının kaymamasının sebebi bu.
 */
const BANNER = {
  premium_001: require("@/assets/badges/premium/premium_001.png"),
  premium_002: require("@/assets/badges/premium/premium_002.png"),
  premium_003: require("@/assets/badges/premium/premium_003.png"),
  premium_004: require("@/assets/badges/premium/premium_004.png"),
  premium_005: require("@/assets/badges/premium/premium_005.png"),
  premium_006: require("@/assets/badges/premium/premium_006.png"),
  premium_007: require("@/assets/badges/premium/premium_007.png"),
  premium_008: require("@/assets/badges/premium/premium_008.png"),
  premium_009: require("@/assets/badges/premium/premium_009.png"),
  premium_010: require("@/assets/badges/premium/premium_010.png"),
  premium_011: require("@/assets/badges/premium/premium_011.png"),
  premium_012: require("@/assets/badges/premium/premium_012.png"),
  premium_013: require("@/assets/badges/premium/premium_013.png"),
  premium_014: require("@/assets/badges/premium/premium_014.png"),
  premium_015: require("@/assets/badges/premium/premium_015.png"),
  premium_016: require("@/assets/badges/premium/premium_016.png"),
  premium_017: require("@/assets/badges/premium/premium_017.png"),
  premium_018: require("@/assets/badges/premium/premium_018.png"),
  premium_019: require("@/assets/badges/premium/premium_019.png"),
  premium_020: require("@/assets/badges/premium/premium_020.png"),
  premium_021: require("@/assets/badges/premium/premium_021.png"),
  premium_022: require("@/assets/badges/premium/premium_022.png"),
  premium_023: require("@/assets/badges/premium/premium_023.png"),
  premium_024: require("@/assets/badges/premium/premium_024.png"),
} as const;

export type PremiumFrame = keyof typeof BANNER;
export const PREMIUM_FRAMES = Object.keys(BANNER) as PremiumFrame[];

/**
 * Çerçeve ölçüleri:
 *   oran       = görselin en/boy oranı (kutu bununla açılır, boşluk kalmaz)
 *   x, y, w, h = boş panelin çerçeveye göre oranı (ID buraya yazılır)
 * Değerler kaynak PNG'lerden otomatik ölçüldü.
 */
const OLCU: Record<PremiumFrame, { oran: number; x: number; y: number; w: number; h: number }> = {
  premium_001: { oran: 2.031, x: 0.4695, y: 0.3605, w: 0.3702, h: 0.2829 },
  premium_002: { oran: 2.451, x: 0.3989, y: 0.4336, w: 0.4838, h: 0.354 },
  premium_003: { oran: 2.424, x: 0.3688, y: 0.3825, w: 0.4867, h: 0.3641 },
  premium_004: { oran: 2.304, x: 0.3755, y: 0.4087, w: 0.4528, h: 0.3261 },
  premium_005: { oran: 2.489, x: 0.3784, y: 0.4305, w: 0.4757, h: 0.3453 },
  premium_006: { oran: 2.322, x: 0.367, y: 0.4043, w: 0.4831, h: 0.3348 },
  premium_007: { oran: 2.602, x: 0.4034, y: 0.3781, w: 0.4321, h: 0.3483 },
  premium_008: { oran: 2.819, x: 0.3438, y: 0.3679, w: 0.4963, h: 0.342 },
  premium_009: { oran: 2.452, x: 0.3782, y: 0.3439, w: 0.441, h: 0.3529 },
  premium_010: { oran: 2.69, x: 0.417, y: 0.3553, w: 0.434, h: 0.3807 },
  premium_011: { oran: 2.694, x: 0.4288, y: 0.3689, w: 0.427, h: 0.3398 },
  premium_012: { oran: 2.7, x: 0.4185, y: 0.33, w: 0.4111, h: 0.395 },
  premium_013: { oran: 2.221, x: 0.3921, y: 0.4333, w: 0.4747, h: 0.2833 },
  premium_014: { oran: 2.394, x: 0.38, y: 0.4706, w: 0.4934, h: 0.3122 },
  premium_015: { oran: 2.784, x: 0.3883, y: 0.3892, w: 0.4796, h: 0.3568 },
  premium_016: { oran: 2.401, x: 0.3877, y: 0.4747, w: 0.4894, h: 0.3134 },
  premium_017: { oran: 2.404, x: 0.3937, y: 0.4133, w: 0.4713, h: 0.3022 },
  premium_018: { oran: 2.705, x: 0.4713, y: 0.456, w: 0.41, h: 0.3057 },
  premium_019: { oran: 2.572, x: 0.372, y: 0.3894, w: 0.4879, h: 0.3413 },
  premium_020: { oran: 2.44, x: 0.3321, y: 0.412, w: 0.5446, h: 0.3194 },
  premium_021: { oran: 2.417, x: 0.4042, y: 0.4074, w: 0.4693, h: 0.3102 },
  premium_022: { oran: 2.847, x: 0.448, y: 0.4021, w: 0.4089, h: 0.3598 },
  premium_023: { oran: 2.417, x: 0.3947, y: 0.3303, w: 0.4516, h: 0.2844 },
  premium_024: { oran: 2.856, x: 0.4544, y: 0.3617, w: 0.419, h: 0.3457 },
};

/**
 * Kabartma ID metni. RN'de tek Text yalnızca bir gölge alabildiği için üç
 * katman üst üste konur: koyu gölge (sağ-alt), açık ışık (sol-üst), ana dolgu.
 * Işık sol üstten geldiği için harfler yüzeyden kabarık görünür.
 */
function KabartmaId({ id, boyut, genislik }: { id: string; boyut: number; genislik: number }) {
  const ortak = {
    position: "absolute" as const,
    width: genislik,
    textAlign: "center" as const,
    fontFamily: Font.extrabold,
    fontSize: boyut,
    letterSpacing: boyut * 0.06,
    includeFontPadding: false,
  };
  return (
    <>
      <Text numberOfLines={1} style={[ortak, { color: "rgba(0,0,0,.68)", transform: [{ translateX: 1.2 }, { translateY: 1.2 }] }]}>
        {id}
      </Text>
      <Text numberOfLines={1} style={[ortak, { color: "rgba(255,255,255,.38)", transform: [{ translateX: -1.2 }, { translateY: -1.2 }] }]}>
        {id}
      </Text>
      <Text numberOfLines={1} style={[ortak, { color: "#F7E7C4" }]}>
        {id}
      </Text>
    </>
  );
}

export function PremiumBanner({ frame, id, width = 220 }: { frame: PremiumFrame; id?: string; width?: number }) {
  // Eski kayıtlar (premium_07 gibi 2 haneli anahtarlar) artık yok. Böyle bir
  // tema DB'de duruyorsa çökmek yerine ID'yi düz yazıyla göster.
  const o = OLCU[frame];
  if (!o || !BANNER[frame]) {
    return id ? (
      <Text
        numberOfLines={1}
        style={{ fontFamily: Font.extrabold, fontSize: Math.max(11, width * 0.075), color: "#F5CE6E", letterSpacing: 1 }}
      >
        {id}
      </Text>
    ) : null;
  }
  const height = width / o.oran;
  // Panel dikdörtgeni (piksel)
  const pw = o.w * width;
  const ph = o.h * height;
  const px = o.x * width;
  const py = o.y * height;
  // Punto panel yüksekliğine oranlı; uzun ID'lerde panele sığsın diye
  // genişliğe göre de sınırlanır (5 hane + boşluklar).
  const boyut = Math.min(ph * 0.66, pw / 3.1);

  return (
    <View style={{ width, height }}>
      <Image source={BANNER[frame]} style={{ width, height }} contentFit="contain" />
      {!!id && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: px, top: py, width: pw, height: ph, alignItems: "center", justifyContent: "center" }}
        >
          <KabartmaId id={id} boyut={boyut} genislik={pw} />
        </View>
      )}
    </View>
  );
}
