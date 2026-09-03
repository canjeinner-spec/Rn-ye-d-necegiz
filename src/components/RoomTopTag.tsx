import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Txt } from "@/components/Txt";
import { Gradient } from "@/theme/Gradient";

export type RoomTier = "daily" | "official";

function Shimmer() {
  const x = useSharedValue(-44);
  useEffect(() => {
    x.value = withRepeat(withDelay(900, withTiming(150, { duration: 1100, easing: Easing.linear })), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: "18deg" }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.streak, style]}>
      <Gradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,.6)", "rgba(255,255,255,0)"]} deg={90} style={{ width: 26, height: 52 }} />
    </Animated.View>
  );
}

export function RoomTopTag({ kind, rank = 1 }: { kind: RoomTier; rank?: number }) {
  const daily = kind === "daily";
  return (
    <View style={styles.tag}>
      <Gradient colors={daily ? ["#F5CE6E", "#B4791C"] : ["#E8C36B", "#8A5E12"]} deg={135} style={StyleSheet.absoluteFill} />
      <Txt weight="extrabold" size={10.5} color="#2E2105" style={{ letterSpacing: 0.3 }}>{daily ? `Daily Top${rank}` : "Resmî Oda"}</Txt>
      {daily && <Shimmer />}
    </View>
  );
}

export function RoomCrest({ kind }: { kind: RoomTier }) {
  const fill = kind === "daily" ? "#F0D9A0" : "#E3C588";
  return (
    <Svg width={96} height={96} viewBox="0 0 100 100">
      {kind === "daily" ? (
        <>
          <Path d="M28 18 H72 V32 C72 46 62 55 50 55 C38 55 28 46 28 32 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M28 22 C13 22 13 41 30 43 L29 37 C20 35 21 27 28 28 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M72 22 C87 22 87 41 70 43 L71 37 C80 35 79 27 72 28 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M46 55 H54 V68 H46 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M37 68 H63 V74 H37 Z" fill={fill} fillOpacity={0.18} />
          <Path d="M32 74 H68 V81 H32 Z" fill={fill} fillOpacity={0.18} />
        </>
      ) : (
        <>
          <Path d="M50 14 L80 24 V46 C80 66 66 78 50 84 C34 78 20 66 20 46 V24 Z" fill={fill} fillOpacity={0.16} />
          <Path d="M37 42 L44 50 L50 38 L56 50 L63 42 V56 H37 Z" fill={fill} fillOpacity={0.26} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  // Satırlar artık köşesiz (liste "gömülü" stile geçti); sağ üst köşedeki
  // 18px yuvarlatma boşluğa bakıyordu. Yalnız sol alt köşe yuvarlak kaldı,
  // etiket şerit gibi duruyor.
  tag: { position: "absolute", top: 0, right: 0, borderBottomLeftRadius: 14, overflow: "hidden", paddingVertical: 5, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  streak: { position: "absolute", top: -16, left: 0 },
});
