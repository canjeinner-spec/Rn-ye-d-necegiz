import { View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { C } from "@/theme/colors";

/**
 * ARON marka işareti — ses dalgası (5 çubuk).
 *
 * Eski hâlinde `BlurView` + mor bir dolgu vardı: giriş ekranındaki hareketli
 * videonun üstünde bulanık ve puslu duruyordu, mor da siyah-altın temanın
 * dışındaydı. Artık her şey tek bir SVG: opak koyu zemin, altın hatlı çerçeve,
 * üstten altın parıltı. Arka plan ne olursa olsun aynı görünür.
 */
export function AronMark({ s = 86, glow = true }: { s?: number; glow?: boolean }) {
  // Çubuklar: 5 adet, ortadaki en uzun. viewBox 100x100 içinde ortalanmış.
  const cw = 7;
  const bosluk = 5;
  const x0 = (100 - (5 * cw + 4 * bosluk)) / 2;
  const yukseklikler = [20, 38, 56, 38, 20];
  const saydamliklar = [0.55, 0.8, 1, 0.8, 0.55];

  return (
    <View
      style={
        glow
          ? {
              shadowColor: C.gold,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: s * 0.28,
              elevation: 10,
            }
          : undefined
      }
    >
      <Svg width={s} height={s} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="aronZemin" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#221B10" />
            <Stop offset="0.55" stopColor="#12100F" />
            <Stop offset="1" stopColor="#0A0910" />
          </LinearGradient>
          <LinearGradient id="aronCerceve" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF1B8" stopOpacity={0.9} />
            <Stop offset="0.5" stopColor="#D69A2E" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFF1B8" stopOpacity={0.35} />
          </LinearGradient>
          <LinearGradient id="aronCubuk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF1B8" />
            <Stop offset="1" stopColor="#D69A2E" />
          </LinearGradient>
          <RadialGradient id="aronParilti" cx="0.5" cy="0.1" r="0.75">
            <Stop offset="0" stopColor={C.gold2} stopOpacity={0.26} />
            <Stop offset="1" stopColor={C.gold2} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="1.25" y="1.25" width="97.5" height="97.5" rx="31" fill="url(#aronZemin)" />
        <Rect x="1.25" y="1.25" width="97.5" height="97.5" rx="31" fill="url(#aronParilti)" />
        <Rect
          x="1.25"
          y="1.25"
          width="97.5"
          height="97.5"
          rx="31"
          fill="none"
          stroke="url(#aronCerceve)"
          strokeWidth="2.5"
        />

        {yukseklikler.map((h, i) => (
          <Rect
            key={i}
            x={x0 + i * (cw + bosluk)}
            y={50 - h / 2}
            width={cw}
            height={h}
            rx={cw / 2}
            fill="url(#aronCubuk)"
            opacity={saydamliklar[i]}
          />
        ))}
      </Svg>
    </View>
  );
}
