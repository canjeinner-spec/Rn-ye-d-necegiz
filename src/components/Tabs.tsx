import { Pressable, View } from "react-native";

import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * Üst sekme şeridi — web mockup'taki `Tabs`. Aktif sekmede altın alt çizgi.
 */
type TabsProps = {
  items: string[];
  active: number;
  set: (i: number) => void;
  pad?: number;
};

export function Tabs({ items, active, set, pad = 18 }: TabsProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 22,
        paddingHorizontal: pad,
        paddingTop: 2,
        borderBottomWidth: 1,
        borderBottomColor: C.line,
      }}
    >
      {items.map((t, i) => (
        <Pressable key={t} onPress={() => set(i)} style={{ paddingTop: 8, paddingBottom: 9 }}>
          <Txt weight={i === active ? "extrabold" : "semibold"} size={12.5} color={i === active ? C.gold : C.dim}>
            {t}
          </Txt>
          {i === active && (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -1,
                height: 2.5,
                borderRadius: 4,
                backgroundColor: C.gold,
              }}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}
