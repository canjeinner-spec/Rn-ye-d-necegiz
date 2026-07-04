import { Image } from "expo-image";
import { Text, View } from "react-native";

import { Font } from "@/theme/fonts";

// Özel ID nameplate çerçeveleri (30 adet) — kullanıcının kendi ürettiği sanat.
// Özel ID tanımlanan kişilere verilir; üzerine istenen ID metni yazılır.
const FRAME = {
  nameplate_01: require("@/assets/badges/nameplate/nameplate_01.png"),
  nameplate_02: require("@/assets/badges/nameplate/nameplate_02.png"),
  nameplate_03: require("@/assets/badges/nameplate/nameplate_03.png"),
  nameplate_04: require("@/assets/badges/nameplate/nameplate_04.png"),
  nameplate_05: require("@/assets/badges/nameplate/nameplate_05.png"),
  nameplate_06: require("@/assets/badges/nameplate/nameplate_06.png"),
  nameplate_07: require("@/assets/badges/nameplate/nameplate_07.png"),
  nameplate_08: require("@/assets/badges/nameplate/nameplate_08.png"),
  nameplate_09: require("@/assets/badges/nameplate/nameplate_09.png"),
  nameplate_10: require("@/assets/badges/nameplate/nameplate_10.png"),
  nameplate_11: require("@/assets/badges/nameplate/nameplate_11.png"),
  nameplate_12: require("@/assets/badges/nameplate/nameplate_12.png"),
  nameplate_13: require("@/assets/badges/nameplate/nameplate_13.png"),
  nameplate_14: require("@/assets/badges/nameplate/nameplate_14.png"),
  nameplate_15: require("@/assets/badges/nameplate/nameplate_15.png"),
  nameplate_16: require("@/assets/badges/nameplate/nameplate_16.png"),
  nameplate_17: require("@/assets/badges/nameplate/nameplate_17.png"),
  nameplate_18: require("@/assets/badges/nameplate/nameplate_18.png"),
  nameplate_19: require("@/assets/badges/nameplate/nameplate_19.png"),
  nameplate_20: require("@/assets/badges/nameplate/nameplate_20.png"),
  nameplate_21: require("@/assets/badges/nameplate/nameplate_21.png"),
  nameplate_22: require("@/assets/badges/nameplate/nameplate_22.png"),
  nameplate_23: require("@/assets/badges/nameplate/nameplate_23.png"),
  nameplate_24: require("@/assets/badges/nameplate/nameplate_24.png"),
  nameplate_25: require("@/assets/badges/nameplate/nameplate_25.png"),
  nameplate_26: require("@/assets/badges/nameplate/nameplate_26.png"),
  nameplate_27: require("@/assets/badges/nameplate/nameplate_27.png"),
  nameplate_28: require("@/assets/badges/nameplate/nameplate_28.png"),
  nameplate_29: require("@/assets/badges/nameplate/nameplate_29.png"),
  nameplate_30: require("@/assets/badges/nameplate/nameplate_30.png"),
} as const;

export type NameplateFrame = keyof typeof FRAME;
export const NAMEPLATE_FRAMES = Object.keys(FRAME) as NameplateFrame[];

// Her çerçevenin metin oturacağı iç panel oranları (frame'e göre normalize).
// Soldaki madalyonlu çerçevelerde metin sağa kayar. Varsayılan simetrik.
type Rect = { l: number; r: number; t: number; b: number };
const DEFAULT_RECT: Rect = { l: 0.19, r: 0.86, t: 0.30, b: 0.72 };
const LEFT_MEDALLION: Record<string, Rect> = {
  nameplate_01: { l: 0.36, r: 0.9, t: 0.3, b: 0.72 },
  nameplate_02: { l: 0.36, r: 0.9, t: 0.3, b: 0.72 },
  nameplate_03: { l: 0.36, r: 0.9, t: 0.32, b: 0.74 },
  nameplate_11: { l: 0.36, r: 0.9, t: 0.32, b: 0.74 },
  nameplate_23: { l: 0.36, r: 0.9, t: 0.34, b: 0.76 },
};

const RATIO = 3.0; // ortalama en-boy (yükseklik = genişlik / RATIO)

export function IdNameplate({
  frame,
  text,
  width = 260,
  color = "#FBE9C8",
}: {
  frame: NameplateFrame;
  text: string;
  width?: number;
  color?: string;
}) {
  const height = width / RATIO;
  const rect = LEFT_MEDALLION[frame] ?? DEFAULT_RECT;
  const boxLeft = width * rect.l;
  const boxWidth = width * (rect.r - rect.l);
  const boxTop = height * rect.t;
  const boxHeight = height * (rect.b - rect.t);
  // metin yüksekliğe göre ölçekle, adjustsFontSizeToFit genişliğe sığdırır
  const fontSize = Math.min(boxHeight * 0.92, width * 0.11);

  return (
    <View style={{ width, height }}>
      <Image source={FRAME[frame]} style={{ width, height }} contentFit="contain" />
      <View
        style={{
          position: "absolute",
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
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
            fontSize,
            color,
            letterSpacing: 1,
            includeFontPadding: false,
            textShadowColor: "rgba(0,0,0,.6)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}
