import { Pressable, StyleSheet, View } from "react-native";

import { Ui } from "@/theme/colors";
import { S, T } from "@/theme/tokens";
import { Txt } from "./Txt";

/**
 * Üst sekme şeridi — WePlay dili: beyaz zemin, aktif sekme aksan renginde
 * ve altında kısa aksan çizgisi, altta ince ayırıcı.
 */
type TabsProps = {
  items: string[];
  active: number;
  set: (i: number) => void;
  pad?: number;
};

export function Tabs({ items, active, set, pad = S.lg }: TabsProps) {
  return (
    <View style={[styles.bar, { paddingHorizontal: pad }]}>
      {items.map((t, i) => {
        const on = i === active;
        return (
          <Pressable key={t} onPress={() => set(i)} style={styles.tab}>
            <Txt weight={on ? "extrabold" : "semibold"} size={T.text} color={on ? Ui.accent : Ui.textSecondary}>
              {t}
            </Txt>
            {on && <View style={styles.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: S.xxl,
    backgroundColor: Ui.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Ui.border,
  },
  tab: { paddingTop: S.md, paddingBottom: S.md },
  underline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    backgroundColor: Ui.accent,
  },
});
