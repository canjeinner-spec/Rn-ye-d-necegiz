import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from "react-native";

import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { Ui } from "@/theme/colors";
import { I, R, S, SZ, T } from "@/theme/tokens";

type Variant = "primary" | "soft" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

/**
 * Buton — WePlay dili: tam yuvarlak (hap) form, tek canlı aksan rengi.
 * Yarıçap 100dp'ye kadar çıkıyordu (en sık kullanılan değer), yani hap.
 */
export function Btn({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  full = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Satırı tamamen kaplasın */
  full?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const v = VARIANTS[variant];
  const height = size === "sm" ? SZ.chip : SZ.button;
  const fontSize = size === "sm" ? T.body : T.title;

  return (
    <Pressable
      onPress={
        off
          ? undefined
          : () => {
              haptic.light();
              onPress?.();
            }
      }
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: size === "sm" ? S.md : S.xl,
          backgroundColor: pressed && v.pressedBg ? v.pressedBg : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1 : 0,
          opacity: off ? 0.45 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {!!icon && <Icon name={icon} size={size === "sm" ? I.xs : I.sm} color={v.fg} />}
          <Txt weight="bold" size={fontSize} color={v.fg}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string; pressedBg?: string }> = {
  primary: { bg: Ui.accent, fg: Ui.onAccent, pressedBg: Ui.accentPressed },
  soft: { bg: Ui.accentSoft, fg: Ui.accentPressed },
  outline: { bg: "transparent", fg: Ui.accent, border: Ui.accent },
  ghost: { bg: "transparent", fg: Ui.textSecondary },
  danger: { bg: Ui.danger, fg: Ui.onAccent },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.sm,
    borderRadius: R.pill,
  },
});
