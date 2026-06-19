import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

const META: Record<string, { ic: IconName; label: string; badge?: string }> = {
  index: { ic: "home", label: "Odalar" },
  rank: { ic: "bars", label: "Sıralama" },
  feed: { ic: "evStar", label: "Akış", badge: "" },
  dm: { ic: "chat", label: "DM", badge: "3" },
  profile: { ic: "user", label: "Profil" },
};

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: 12 + insets.bottom }]} pointerEvents="box-none">
      <Gradient colors={["rgba(8,8,12,0)", "rgba(8,8,12,0.35)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.capsule}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <Gradient colors={["rgba(40,36,55,0.34)", "rgba(16,14,22,0.42)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.glint} pointerEvents="none" />
        {state.routes.map((route, i) => {
          const meta = META[route.name];
          if (!meta) return null;
          const on = state.index === i;
          const color = on ? C.gold : C.dim2;
          const onPress = () => {
            haptic.select();
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!on && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item}>
              {on && <View style={styles.activePill} />}
              <View>
                <Icon name={meta.ic} size={20} sw={on ? 2 : 1.9} color={color} />
                {meta.badge != null &&
                  (meta.badge ? (
                    <View style={styles.badge}>
                      <Txt weight="extrabold" size={8} color="#fff">{meta.badge}</Txt>
                    </View>
                  ) : (
                    <View style={styles.dot} />
                  ))}
              </View>
              <Txt weight="bold" size={9} color={color} style={{ marginTop: 3 }}>
                {meta.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 6 },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(20,18,28,0.4)",
  },
  glint: { position: "absolute", top: 0, left: "22%", right: "22%", height: 1, backgroundColor: "rgba(255,255,255,.5)" },
  item: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 999 },
  activePill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: "rgba(232,179,65,0.1)", borderWidth: 1, borderColor: "rgba(232,179,65,0.22)" },
  badge: { position: "absolute", top: -5, right: -8, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 4, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#14121C" },
  dot: { position: "absolute", top: -3, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F43F5E", borderWidth: 1.5, borderColor: "#14121C" },
});
