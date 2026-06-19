import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { C } from "@/theme/colors";

/**
 * Konuşma / "yayında" eşitleyici animasyonu — web mockup'taki `.eq`.
 * 4 çubuk, farklı yükseklik ve gecikmeyle scaleY 0.45↔1 döngüsü.
 */
const BARS = [
  { h: 7, delay: 0 },
  { h: 14, delay: 150 },
  { h: 10, delay: 300 },
  { h: 15, delay: 450 },
];

function Bar({ h, delay, color }: { h: number; delay: number; color: string }) {
  const sv = useSharedValue(0.45);
  useEffect(() => {
    sv.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, [sv, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: sv.value }] }));
  return <Animated.View style={[{ width: 3, height: h, borderRadius: 2, backgroundColor: color }, style]} />;
}

export function Eq({ color = C.gold }: { color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2.5, alignItems: "flex-end", height: 16 }}>
      {BARS.map((b, i) => (
        <Bar key={i} h={b.h} delay={b.delay} color={color} />
      ))}
    </View>
  );
}
