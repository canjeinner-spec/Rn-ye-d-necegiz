import { useRouter } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C, Ui } from "@/theme/colors";
import { I, S, SZ, T } from "@/theme/tokens";

/**
 * Üst bar — WePlay'in iki başlık kalıbı:
 *
 *  big=true  → sekme kökü sayfası. 72dp yükseklik, 26dp kalın başlık, sola
 *              yaslı, geri tuşu yok. (WePlay: home_discover_view başlığı)
 *  big=false → alt sayfa. 44dp yükseklik, ortada 16dp başlık, solda geri oku.
 *
 * İkisi de beyaz zeminli; gri sayfa zemininden böyle ayrılır.
 */
export function TopBar({
  title,
  big = false,
  onBack,
  right,
  hideBack = false,
}: {
  title: string;
  big?: boolean;
  onBack?: () => void;
  /** Sağ taraftaki aksiyon(lar) */
  right?: ReactNode;
  hideBack?: boolean;
}) {
  const router = useRouter();
  const back = () => {
    haptic.light();
    if (onBack) onBack();
    else router.back();
  };

  if (big) {
    return (
      <View style={[styles.bar, styles.barBig]}>
        <Txt weight="displayBold" size={26} color={Ui.textTitle} style={{ flex: 1 }}>
          {title}
        </Txt>
        {right}
      </View>
    );
  }

  return (
    <View style={[styles.bar, styles.barSmall]}>
      {!hideBack ? (
        <Pressable onPress={back} hitSlop={8} style={styles.backBtn}>
          <Icon name="back" size={I.sm} color={C.text} />
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Txt weight="bold" size={T.title} color={C.text} numberOfLines={1} style={styles.titleCenter}>
        {title}
      </Txt>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Ui.surface,
    paddingHorizontal: S.lg,
  },
  /** WePlay: 72dp büyük başlık */
  barBig: { height: 72, gap: S.md },
  barSmall: { height: 44 },
  backBtn: { width: SZ.iconBtn, height: SZ.iconBtn, alignItems: "flex-start", justifyContent: "center" },
  titleCenter: { flex: 1, textAlign: "center" },
  rightSlot: { width: SZ.iconBtn, alignItems: "flex-end", justifyContent: "center" },
});
