import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Eq } from "./Eq";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

/**
 * Oda küçültülünce alt tarafta duran şerit.
 *
 * Eskiden baştan sona mordu (halka, puls, çerçeve, "Odaya dön" yazısı) ve
 * mor uygulamanın teması değil. Yazının başında da 🎙️ emojisi vardı —
 * emojiler ikon setine taşınmıştı, bu biri unutulmuş. Ayrıca şeritten
 * odadan ÇIKIŞ yoktu: çıkmak için önce odaya geri dönmek gerekiyordu.
 */
export function MinimizedRoomBanner({
  room,
  onPress,
  onLeave,
  bottom,
}: {
  room: Room;
  onPress: () => void;
  onLeave?: () => void;
  bottom: number;
}) {
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
        <Portrait name={room.name} size={34} ring={C.gold} glow photo={room.photo} />
        <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none" />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="extrabold" size={12} color="#fff" numberOfLines={1}>
          {room.name}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
          <Icon name="mic" size={10} sw={2} color={C.gold2} />
          <Txt weight="bold" size={10} color={C.gold2}>Odaya dön</Txt>
          {room.online > 0 && (
            <Txt weight="semibold" size={10} color={C.dim2} numberOfLines={1}>· {room.online} kişi</Txt>
          )}
        </View>
      </View>

      <Eq />

      {onLeave && (
        <>
          <View style={styles.ayirici} />
          <Pressable
            onPress={() => { haptic.light(); onLeave(); }}
            hitSlop={10}
            style={styles.cikBtn}
          >
            <Icon name="x" size={14} sw={2.2} color={C.dim} />
          </Pressable>
        </>
      )}
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
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.gold + "3D",
    backgroundColor: "rgba(12,11,16,.95)",
    // Şerit ekranın üstünde yüzüyor; altın gölge onu zeminden ayırıyor.
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  pulseRing: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: C.gold,
  },
  ayirici: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: "rgba(255,255,255,.14)" },
  cikBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.kontrol },
});
