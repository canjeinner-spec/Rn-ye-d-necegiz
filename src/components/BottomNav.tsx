import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type DMThread } from "@/data/dm";
import { getCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { FEATURES } from "@/lib/features";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Touch } from "./Touch";
import { Txt } from "./Txt";

// iOS 26+ liquid glass; değilse (Android / eski iOS) BlurView fallback'ine düşer.
const LIQUID = isLiquidGlassAvailable();

const META: Record<string, { ic: IconName; label: string }> = {
  index: { ic: "home", label: "Odalar" },
  rank: { ic: "bars", label: "Sıralama" },
  feed: { ic: "evStar", label: "Akış" },
  dm: { ic: "chat", label: "DM" },
  profile: { ic: "user", label: "Profil" },
};

/** Sekme ikonu — seçiliyken hafifçe büyür, altın parıltı alır. */
function SekmeIkon({ ic, on }: { ic: IconName; on: boolean }) {
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(on ? 1 : 0, { damping: 14, stiffness: 190 });
  }, [on, s]);
  const stil = useAnimatedStyle(() => ({ transform: [{ scale: 1 + s.value * 0.1 }] }));
  return (
    <Animated.View style={[stil, on && styles.ikonIsik]}>
      <Icon name={ic} size={20} sw={on ? 2.2 : 1.8} color={on ? C.gold2 : C.dim2} />
    </Animated.View>
  );
}

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Görünen sekmeler (gizli olanlar çıkarılmış) — gösterge bunlara göre kayar.
  const sekmeler = state.routes.filter((r) => META[r.name] && (r.name !== "rank" || FEATURES.rankTab));
  const aktifSira = sekmeler.findIndex((r) => r.key === state.routes[state.index]?.key);

  /**
   * Aktif gösterge, sekmeler arasında KAYAR. Önceden her sekmenin altında
   * ayrı bir kutu vardı ve seçim anında zıplıyordu.
   */
  const [genislik, setGenislik] = useState(0);
  const x = useSharedValue(0);
  const sekmeGen = genislik / Math.max(1, sekmeler.length);

  const olc = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setGenislik(w);
    x.value = (w / Math.max(1, sekmeler.length)) * Math.max(0, aktifSira);
  };
  useEffect(() => {
    if (!genislik || aktifSira < 0) return;
    x.value = withTiming(sekmeGen * aktifSira, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [aktifSira, sekmeGen, genislik, x]);
  const gostergeStil = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  /**
   * DM rozeti GERÇEK okunmamış sayısı. Önceden META'da sabit "3" yazıyordu;
   * hiç mesajı olmayan kullanıcıda bile 3 görünüyordu. Akış sekmesinde de
   * koşulsuz bir nokta vardı.
   */
  const [dmUnread, setDmUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const t = getCached<DMThread[]>("dm:threads") ?? [];
      setDmUnread(t.reduce((n, d) => n + (d.unread || 0), 0));
    }, [state.index]),
  );

  return (
    <View style={[styles.wrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
      <Gradient colors={["rgba(8,8,12,0)", "rgba(8,8,12,0.35)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.capsule, LIQUID && styles.capsuleGlass]}>
        {LIQUID ? (
          <GlassView glassEffectStyle="regular" tintColor="rgba(20,18,28,0.4)" colorScheme="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : (
          <>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(40,36,55,0.34)", "rgba(16,14,22,0.42)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
          </>
        )}
        <View style={styles.glint} pointerEvents="none" />

        <View style={{ flexDirection: "row", flex: 1 }} onLayout={olc}>
          {/* Kayan altın gösterge — sekmelerin ARKASINDA */}
          {genislik > 0 && aktifSira >= 0 && (
            <Animated.View style={[styles.gostergeYuva, { width: sekmeGen }, gostergeStil]} pointerEvents="none">
              <View style={styles.gosterge}>
                <Gradient colors={["rgba(232,179,65,0.20)", "rgba(232,179,65,0.06)"]} deg={180} style={StyleSheet.absoluteFill} />
              </View>
            </Animated.View>
          )}

          {sekmeler.map((route) => {
            const meta = META[route.name];
            const on = state.routes[state.index]?.key === route.key;
            const onPress = () => {
              haptic.select();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!on && !event.defaultPrevented) navigation.navigate(route.name);
            };
            const rozet = route.name === "dm" && dmUnread > 0 ? (dmUnread > 99 ? "99+" : String(dmUnread)) : null;
            return (
              <Touch key={route.key} onPress={onPress} style={styles.item} kucul={false}>
                <View>
                  <SekmeIkon ic={meta.ic} on={on} />
                  {rozet && (
                    <View style={styles.badge}>
                      <Txt weight="extrabold" size={8} color="#fff">{rozet}</Txt>
                    </View>
                  )}
                </View>
                <Txt weight={on ? "extrabold" : "bold"} size={9.5} color={on ? C.gold2 : C.dim2} style={{ marginTop: 4 }}>
                  {meta.label}
                </Txt>
              </Touch>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 6 },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(20,18,28,0.4)",
  },
  // Liquid glass modunda solid arka planı kaldır; malzemeyi GlassView verir.
  capsuleGlass: { backgroundColor: "transparent" },
  glint: { position: "absolute", top: 0, left: "22%", right: "22%", height: 1, backgroundColor: "rgba(255,255,255,.5)" },
  item: { flex: 1, alignItems: "center", paddingVertical: 7 },
  gostergeYuva: { position: "absolute", top: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  gosterge: {
    alignSelf: "stretch",
    marginHorizontal: 4,
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,179,65,0.28)",
  },
  ikonIsik: {
    shadowColor: C.gold,
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  badge: { position: "absolute", top: -5, right: -8, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 4, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#14121C" },
});
