import { Image } from "expo-image";
import { Text, View } from "react-native";

import { type OzelIdKart } from "@/data/specialId";
import { Gradient } from "@/theme/Gradient";
import { Font } from "@/theme/fonts";

// 25 premium ÖZEL ID kart çerçevesi — kullanıcının kendi ürettiği gerçek sanat.
const CARD = {
  bronze: require("@/assets/badges/idcard/bronze.png"),
  silver: require("@/assets/badges/idcard/silver.png"),
  gold: require("@/assets/badges/idcard/gold.png"),
  platinum: require("@/assets/badges/idcard/platinum.png"),
  diamond: require("@/assets/badges/idcard/diamond.png"),
  legendary: require("@/assets/badges/idcard/legendary.png"),
  mythic: require("@/assets/badges/idcard/mythic.png"),
  celestial: require("@/assets/badges/idcard/celestial.png"),
  void: require("@/assets/badges/idcard/void.png"),
  emerald: require("@/assets/badges/idcard/emerald.png"),
  pearl: require("@/assets/badges/idcard/pearl.png"),
  ice: require("@/assets/badges/idcard/ice.png"),
  dragon: require("@/assets/badges/idcard/dragon.png"),
  shadow: require("@/assets/badges/idcard/shadow.png"),
  cyber: require("@/assets/badges/idcard/cyber.png"),
  royal: require("@/assets/badges/idcard/royal.png"),
  demon: require("@/assets/badges/idcard/demon.png"),
  holy: require("@/assets/badges/idcard/holy.png"),
  futuristic: require("@/assets/badges/idcard/futuristic.png"),
  nature: require("@/assets/badges/idcard/nature.png"),
  samurai: require("@/assets/badges/idcard/samurai.png"),
  pirate: require("@/assets/badges/idcard/pirate.png"),
  steampunk: require("@/assets/badges/idcard/steampunk.png"),
  music: require("@/assets/badges/idcard/music.png"),
  star: require("@/assets/badges/idcard/star.png"),
} as const;

export const OZEL_ID_KART_KAYNAK = CARD;

// Kartın gövdesindeki slot oranları (görsel W×H'ye göre). Kartların ID-kart
// düzeni ortak: solda kişi ikonu, sağda metin bantları. Kanatlı kartlarda
// gövde biraz dar; varsayılan çoğunu tutar, gerekirse frame'e özel geçilebilir.
const PHOTO_RECT = { l: 0.235, r: 0.4, t: 0.42, b: 0.74 };
const TEXT_RECT = { l: 0.47, r: 0.79, t: 0.42, b: 0.72 };
const CARD_RATIO = 1.9; // ortalama en-boy (yükseklik = genişlik / oran)

/**
 * Premium ÖZEL ID kartı (≤5 basamak). Çerçeve çizilir, ID metni kart üzerine
 * (metin bandına) yazılır; opsiyonel foto kişi slotuna oturur.
 */
export function OzelIdKart({
  frame,
  id,
  photo,
  width = 230,
}: {
  frame: OzelIdKart;
  id: string;
  photo?: string;
  width?: number;
}) {
  const height = width / CARD_RATIO;
  const tx = TEXT_RECT, px = PHOTO_RECT;
  return (
    <View style={{ width, height }}>
      <Image source={CARD[frame]} style={{ width, height }} contentFit="contain" />

      {photo && (
        <Image
          source={{ uri: photo }}
          style={{
            position: "absolute",
            left: width * px.l,
            top: height * px.t,
            width: width * (px.r - px.l),
            height: height * (px.b - px.t),
            borderRadius: 6,
          }}
          contentFit="cover"
        />
      )}

      <View
        style={{
          position: "absolute",
          left: width * tx.l,
          top: height * tx.t,
          width: width * (tx.r - tx.l),
          height: height * (tx.b - tx.t),
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: Font.displayBold,
            fontSize: height * 0.2,
            color: "#FFF7E6",
            letterSpacing: 1,
            includeFontPadding: false,
            textShadowColor: "rgba(0,0,0,.55)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {id}
        </Text>
      </View>
    </View>
  );
}

/**
 * ID kapsülü (6–7 basamak). Süslü çerçeve yok — ID rakamı premium bir
 * kapsülün içine alınır. UI chrome (elle stillenmiş), sanat eseri değil.
 */
export function IdKapsul({ id, size = 13 }: { id: string; size?: number }) {
  return (
    <Gradient
      colors={["#3A2E12", "#1A1508"]}
      deg={180}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingVertical: size * 0.28,
        paddingHorizontal: size * 0.72,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#E8B34155",
      }}
    >
      <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: 999, backgroundColor: "#E8B341" }} />
      <Text
        style={{
          fontFamily: Font.extrabold,
          fontSize: size,
          color: "#F5CE6E",
          letterSpacing: 1.5,
          includeFontPadding: false,
        }}
      >
        {id}
      </Text>
    </Gradient>
  );
}
