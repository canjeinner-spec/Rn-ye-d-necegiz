import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { TIER_RING } from "@/data/gifts";
import { type BroadcastData } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

export function GlobalBroadcast({ data, onGo, top = 52 }: { data: BroadcastData; onGo: () => void; top?: number }) {
  const ring = TIER_RING[data.gift.tier] || C.gold;
  const { width } = useWindowDimensions();
  const [w, setW] = useState(0);
  const x = useSharedValue(width);

  useEffect(() => {
    if (!w) return;
    x.value = width;
    x.value = withTiming(-w - 20, { duration: 16000, easing: Easing.linear });
  }, [w, width, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.lane, { top }]} pointerEvents="box-none">
      <Animated.View style={style}>
        <Pressable
          onPress={onGo}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={[styles.pill, { borderColor: ring + "66" }]}
        >
          <Portrait name={data.sender} size={26} ring={ring} glow />
          <View style={styles.row}>
            <Txt weight="extrabold" size={11} color={ring}>{data.sender}</Txt>
            <Txt size={11} color="rgba(255,255,255,.68)">kullanıcısı</Txt>
            <Txt weight="extrabold" size={11} color="#FCA5A5">{data.recipient || "Herkese"}</Txt>
            {data.recipient && data.recipient !== "Herkese" && (
              <Txt size={11} color="rgba(255,255,255,.68)">kişisine</Txt>
            )}
            <Txt size={14}>{data.gift.emoji}</Txt>
            <Txt weight="extrabold" size={11} color={ring}>{data.gift.name}</Txt>
            <Txt size={11} color="rgba(255,255,255,.68)">×{data.qty} gönderdi!</Txt>
          </View>
          <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.go}>
            <Txt weight="extrabold" size={11} color="#3A2A05">Git ›</Txt>
          </Gradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { position: "absolute", left: 0, right: 0, overflow: "hidden", zIndex: 55 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 6,
    borderRadius: 999,
    marginLeft: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    backgroundColor: "rgba(18,30,38,0.75)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  go: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999 },
});
