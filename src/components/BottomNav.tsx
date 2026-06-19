import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
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
    <View style={[styles.wrap, { paddingBottom: 6 + insets.bottom }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.fill} pointerEvents="none" />
      <View style={styles.topline} pointerEvents="none" />
      {state.routes.map((route, i) => {
        const meta = META[route.name];
        if (!meta) return null;
        const on = state.index === i;
        const color = on ? C.gold : C.dim2;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!on && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.item}>
            <View>
              <Icon name={meta.ic} size={22} sw={on ? 2 : 1.8} color={color} />
              {meta.badge != null && (
                meta.badge ? (
                  <View style={styles.badge}>
                    <Txt weight="extrabold" size={8} color="#fff">{meta.badge}</Txt>
                  </View>
                ) : (
                  <View style={styles.dot} />
                )
              )}
            </View>
            <Txt weight={on ? "extrabold" : "semibold"} size={9.5} color={color} style={{ marginTop: 4 }}>
              {meta.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", paddingTop: 9, paddingHorizontal: 6, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,9,14,0.82)" },
  topline: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,.07)" },
  item: { flex: 1, alignItems: "center" },
  badge: { position: "absolute", top: -5, right: -8, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 4, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#0A090E" },
  dot: { position: "absolute", top: -3, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#F43F5E", borderWidth: 1.5, borderColor: "#0A090E" },
});
