import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { Gradient } from "@/theme/Gradient";

export function MenuIcon({ icon, g1, g2, size = 32 }: { icon: IconName; g1: string; g2: string; size?: number }) {
  return (
    <Gradient
      colors={[g1, g2]}
      deg={135}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: g1,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Icon name={icon} size={size * 0.52} sw={2} color="#fff" />
    </Gradient>
  );
}
