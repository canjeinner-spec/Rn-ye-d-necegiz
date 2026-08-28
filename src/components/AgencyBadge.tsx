import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

import { C } from "@/theme/colors";

/**
 * Ajans arması — ajansın sıralamadaki gücüne göre kademeli.
 *
 * Ajanslar için hazır bir rozet seti yoktu; sıralamada hepsi aynı
 * `AgencyEmblem`'i taşıyordu, yani birinci ajansla sonuncusu aynı görünüyordu.
 * Bu arma dört kademe çiziyor:
 *
 *   1 → altın, taçlı, defne dallı, ışıklı  (şampiyon)
 *   2 → gümüş, defne dallı
 *   3 → bronz, defne dallı
 *   0 → sade çelik (sıralama dışı / normal ajans)
 *
 * PNG değil SVG: `RoomCrest`/`AgencyEmblem` de böyle, her boyutta net kalıyor
 * ve dosya eklemeye gerek yok.
 */
export type AgencyTier = 0 | 1 | 2 | 3;

const TON: Record<AgencyTier, { a: string; b: string; c: string; kenar: string; tas: string }> = {
  1: { a: "#FFF3C4", b: "#F0C457", c: "#9A6B1C", kenar: "#6E4A0F", tas: "#FDE68A" },
  2: { a: "#F4F7FB", b: "#C7CCD6", c: "#7C838F", kenar: "#5A616B", tas: "#E8EDF5" },
  3: { a: "#F6D9BE", b: "#C9803B", c: "#7A4A1C", kenar: "#5C3714", tas: "#F0BE8C" },
  0: { a: "#8E95A3", b: "#5C6472", c: "#39404C", kenar: "#2A2F38", tas: "#AEB6C4" },
};

export function AgencyBadge({ tier = 0, size = 40 }: { tier?: AgencyTier; size?: number }) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const t = TON[tier];
  const govde = `ab_g_${u}`;
  const kenarG = `ab_k_${u}`;
  const tasG = `ab_t_${u}`;
  const sampiyon = tier === 1;

  return (
    <View
      style={
        sampiyon
          ? {
              shadowColor: C.gold,
              shadowOpacity: 0.8,
              shadowRadius: size * 0.28,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            }
          : undefined
      }
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={govde} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.a} />
            <Stop offset="0.45" stopColor={t.b} />
            <Stop offset="1" stopColor={t.c} />
          </LinearGradient>
          <LinearGradient id={kenarG} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.a} />
            <Stop offset="1" stopColor={t.c} />
          </LinearGradient>
          <RadialGradient id={tasG} cx="0.4" cy="0.32" r="0.7">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="0.45" stopColor={t.tas} />
            <Stop offset="1" stopColor={t.c} />
          </RadialGradient>
        </Defs>

        {/* Defne dalları — ilk üçte */}
        {tier > 0 && (
          <G fill={`url(#${kenarG})`} opacity={0.9}>
            <Path d="M14 30c-4 3-5 8-4 13 3-1 6-4 7-8zM12 39c-3 3-3 7-2 10 3-1 5-4 5-7z" />
            <Path d="M50 30c4 3 5 8 4 13-3-1-6-4-7-8zM52 39c3 3 3 7 2 10-3-1-5-4-5-7z" />
          </G>
        )}

        {/* Taç — yalnız şampiyonda */}
        {sampiyon && (
          <Path
            d="M22 14l4 5 6-8 6 8 4-5 1.5 9h-23z"
            fill={`url(#${govde})`}
            stroke={t.kenar}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        )}

        {/* Kalkan gövdesi */}
        <Path
          d="M32 24 L48 29 V40 c0 9-7 15-16 18-9-3-16-9-16-18V29 Z"
          fill={`url(#${govde})`}
          stroke={t.kenar}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Üstteki parıltı bandı */}
        <Path d="M32 26.5 L45.5 30.7 V33 c-4.5-2-9-3-13.5-3s-9 1-13.5 3v-2.3 Z" fill="#FFFFFF" opacity={0.28} />

        {/* Merkez taş — yıldız */}
        <Path
          d="M32 33 l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
          fill={`url(#${tasG})`}
          stroke={t.kenar}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Sıra numarasından kademe: 1-2-3 özel, gerisi sade. */
export function agencyTier(sira: number): AgencyTier {
  return sira === 1 || sira === 2 || sira === 3 ? (sira as AgencyTier) : 0;
}
