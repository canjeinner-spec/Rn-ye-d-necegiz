import { View } from "react-native";

import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

type RoleType = "host" | "mod";

const MAP: Record<RoleType, { label: string; g1: string; g2: string; color: string; glow: string }> = {
  host: { label: "Oda Sahibi", g1: "#D97706", g2: "#92400E", color: "#FEF3C7", glow: "#D97706" },
  mod: { label: "Yardımcı", g1: "#7C3AED", g2: "#3B0D8C", color: "#EDE9FE", glow: "#7C3AED" },
};

export function RolePill({ type = "host" }: { type?: RoleType }) {
  const c = MAP[type] || MAP.host;
  return (
    <View
      style={{
        shadowColor: c.glow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.33,
        shadowRadius: 5,
        elevation: 3,
        borderRadius: 999,
      }}
    >
      <Gradient
        colors={[c.g1, c.g2]}
        deg={135}
        style={{
          paddingVertical: 2.5,
          paddingHorizontal: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,.14)",
        }}
      >
        <Txt weight="extrabold" size={9} color={c.color} style={{ letterSpacing: 0.3 }}>
          {c.label}
        </Txt>
      </Gradient>
    </View>
  );
}
