import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { C } from "@/theme/colors";

export function AronMark({ s = 86 }: { s?: number }) {
  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: s * 0.32,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.18)",
        shadowColor: C.gold,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.33,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(124,58,237,.14)" }]} />
      <Svg width={s * 0.5} height={s * 0.5} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="aronMarkG" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF1B8" />
            <Stop offset="1" stopColor="#D69A2E" />
          </LinearGradient>
        </Defs>
        <Rect x="6" y="20" width="4" height="8" rx="2" fill="url(#aronMarkG)" opacity={0.55} />
        <Rect x="14" y="14" width="4" height="20" rx="2" fill="url(#aronMarkG)" opacity={0.8} />
        <Rect x="22" y="8" width="4" height="32" rx="2" fill="url(#aronMarkG)" />
        <Rect x="30" y="14" width="4" height="20" rx="2" fill="url(#aronMarkG)" opacity={0.8} />
        <Rect x="38" y="20" width="4" height="8" rx="2" fill="url(#aronMarkG)" opacity={0.55} />
      </Svg>
    </View>
  );
}
