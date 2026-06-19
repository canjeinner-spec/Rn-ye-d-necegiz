import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { Txt } from "./Txt";

/**
 * Küçük etiket kapsülü — web mockup'taki `Pill`.
 * İçerik metin ya da (ikon + metin) olabilir.
 */
type PillProps = {
  children: ReactNode;
  bg?: string;
  color?: string;
  border?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Pill({ children, bg, color = "#fff", border, style, textStyle }: PillProps) {
  return (
    <View
      style={[
        styles.pill,
        bg ? { backgroundColor: bg } : null,
        border ? { borderWidth: 1, borderColor: border } : null,
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Txt weight="extrabold" size={10} color={color} style={[{ letterSpacing: 0.3 }, textStyle]}>
          {children}
        </Txt>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
});
