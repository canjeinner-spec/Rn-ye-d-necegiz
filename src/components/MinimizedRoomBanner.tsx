import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { type Room } from "@/data/seed";
import { C } from "@/theme/colors";
import { Eq } from "./Eq";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

export function MinimizedRoomBanner({ room, onPress, bottom }: { room: Room; onPress: () => void; bottom: number }) {
  const pulse = useSharedValue(0.94);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.24, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 0.94) / 0.3,
  }));

  return (
    <Pressable onPress={onPress} style={[styles.wrap, { bottom }]}>
      <View>
        {/* Oda fotoğrafı varsa o gösterilir; yoksa oda adının baş harfi.
            Önce hiç foto verilmiyordu, küçültülen oda tanınmıyordu. */}
        <Portrait name={room.name} size={34} ring={C.purple2} glow photo={room.photo} />
        <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="extrabold" size={12} color="#fff" numberOfLines={1}>
          {room.name}
        </Txt>
        <Txt weight="semibold" size={10} color={C.purple2}>
          🎙️ Odaya dön
        </Txt>
      </View>
      <Eq />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,.33)",
    backgroundColor: "rgba(20,16,32,0.92)",
  },
  pulseRing: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: C.purple2,
  },
});
