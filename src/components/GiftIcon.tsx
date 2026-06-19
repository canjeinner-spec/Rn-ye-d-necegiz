import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { type Gift, TIER_RING } from "@/data/gifts";
import { Txt } from "./Txt";

export function GiftIcon({ gift, size = 54 }: { gift: Gift; size?: number }) {
  const ring = TIER_RING[gift.tier] || TIER_RING.normal;
  const legendary = gift.tier === "legendary";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: ring,
        backgroundColor: "rgba(255,255,255,.08)",
        shadowColor: ring,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: legendary ? 0.9 : 0.45,
        shadowRadius: legendary ? 10 : 6,
        elevation: 5,
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`gi_${gift.id}`} cx="50%" cy="100%" r="70%">
            <Stop offset="0" stopColor={gift.c2} stopOpacity={0.5} />
            <Stop offset="1" stopColor={gift.c2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={size / 2} cy={size} rx={size * 0.55} ry={size * 0.5} fill={`url(#gi_${gift.id})`} />
      </Svg>
      <View style={[styles.glint, { top: size * 0.08, left: size * 0.18, width: size * 0.5, height: size * 0.26, borderRadius: size * 0.25 }]} />
      <Txt size={size * 0.46}>{gift.emoji}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  glint: { position: "absolute", backgroundColor: "rgba(255,255,255,.3)" },
});
