import { BlurView } from "expo-blur";
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Gradient } from "./Gradient";

/**
 * Web mockup'taki `.gpanel` (LIQUID GLASS PANEL) standardının RN karşılığı.
 * BlurView + yarı saydam gradyan dolgu + ince kenarlık + üstte signature glint çizgisi.
 *
 * `sheet` true ise üst köşeler yuvarlak (alttan açılan sheet varyantı).
 */
type GlassPanelProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  sheet?: boolean;
  intensity?: number;
  glint?: boolean;
};

export function GlassPanel({
  children,
  style,
  radius = 24,
  sheet = false,
  intensity = 30,
  glint = true,
}: GlassPanelProps) {
  const borderRadius = sheet
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : { borderRadius: radius };

  return (
    <View style={[styles.wrap, borderRadius, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <Gradient
        colors={["rgba(40,36,55,0.78)", "rgba(15,13,21,0.9)"]}
        deg={168}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {glint && <View style={styles.glint} pointerEvents="none" />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(20,18,28,0.6)",
  },
  // ::before üst parıltı çizgisi (signature glint)
  glint: {
    position: "absolute",
    top: 0,
    left: "14%",
    right: "14%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
});
