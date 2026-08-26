import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { C, Ui } from "@/theme/colors";
import { I, S, T } from "@/theme/tokens";

/**
 * Gruplanmış liste — WePlay'in ana içerik kalıbı.
 *
 * Beyaz blok, tam genişlik, satırlar arasında içeriden 16dp boşluklu ince
 * ayırıcı. Bloklar arasında gri sayfa zemini görünür (`gap` prop'u).
 * WePlay'de bu boşluk 10dp; varsayılan o.
 */
export function Group({
  children,
  gap = 10,
  title,
}: {
  children: ReactNode;
  /** Bu bloğun ÜSTÜNDE bırakılacak gri boşluk (0 = bitişik) */
  gap?: number;
  /** Blok üstü küçük gri başlık (opsiyonel) */
  title?: string;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <>
      {gap > 0 && <View style={{ height: gap }} />}
      {!!title && (
        <Txt weight="semibold" size={T.body} color={Ui.textTips} style={styles.groupTitle}>
          {title}
        </Txt>
      )}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={styles.divider} />}
            {row}
          </Fragment>
        ))}
      </View>
    </>
  );
}

/**
 * Liste satırı — WePlay ölçüleri: 50dp yükseklik, 20dp ikon (soldan 16),
 * 16dp etiket (ikondan 15), sağda chevron (sağdan 16).
 */
export function Row({
  icon,
  iconColor = Ui.accent,
  label,
  value,
  onPress,
  right,
  chevron = true,
  danger = false,
}: {
  icon?: IconName;
  iconColor?: string;
  label: string;
  /** Sağda, chevron'dan önce gösterilen gri değer metni */
  value?: string;
  onPress?: () => void;
  /** Değer yerine özel içerik */
  right?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {!!icon && <Icon name={icon} size={I.md} color={danger ? Ui.danger : iconColor} />}
      <Txt
        weight="medium"
        size={T.title}
        color={danger ? Ui.danger : Ui.textTitle}
        numberOfLines={1}
        style={[styles.label, !icon && { marginStart: 0 }]}
      >
        {label}
      </Txt>
      {!!value && (
        <Txt size={T.text} color={Ui.textTertiary} numberOfLines={1}>
          {value}
        </Txt>
      )}
      {right}
      {chevron && !!onPress && <Icon name="chev" size={I.sm} color={Ui.textTertiary} />}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      android_ripple={{ color: "rgba(0,0,0,.06)" }}
      style={({ pressed }) => pressed && { backgroundColor: Ui.surfaceAlt }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: Ui.surface },
  groupTitle: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm },
  /** WePlay: 50dp satır, yatay iç boşluk 16 */
  row: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S.lg,
    gap: S.sm,
    backgroundColor: "transparent",
  },
  /** İkondan sonra 15dp — WePlay discover_item_text */
  label: { flex: 1, marginStart: 7 },
  /** 0.5dp ayırıcı, iki yandan 16dp içeride */
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginHorizontal: S.lg },
});
