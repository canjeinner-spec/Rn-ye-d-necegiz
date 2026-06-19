import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

const META: Record<string, { ic: IconName; label: string }> = {
  index: { ic: "home", label: "Odalar" },
  rank: { ic: "bars", label: "Sıralama" },
  feed: { ic: "evStar", label: "Akış" },
  dm: { ic: "chat", label: "DM" },
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
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!on && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item}>
              {on && <View style={styles.activePill} />}
              <Icon name={meta.ic} size={20} sw={1.9} color={on ? C.gold : C.dim2} />
              <Txt weight="bold" size={9} color={on ? C.gold : C.dim2} style={{ marginTop: 3 }}>
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
  activePill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "rgba(232,179,65,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,179,65,0.22)",
  },
});
