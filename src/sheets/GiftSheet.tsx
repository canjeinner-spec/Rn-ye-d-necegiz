import { BlurView } from "expo-blur";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { GiftIcon } from "@/components/GiftIcon";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { GIFTS, GIFT_TABS, type Gift } from "@/data/gifts";
import { type Seat } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const QTY = [1, 7, 14, 99, 520];

export function GiftSheet({
  visible,
  onClose,
  recipients = [],
  coins = 860,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  recipients?: Seat[];
  coins?: number;
  onSend: (gift: Gift, qty: number, recipient: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [qtyIdx, setQtyIdx] = useState(0);
  const [target, setTarget] = useState(0);
  const list = GIFTS[tab] || [];
  const selGift = list.find((g) => g.id === sel) || null;
  const qty = QTY[qtyIdx];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(280)} style={styles.sheet}>
          <Pressable>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(34,26,52,0.82)", "rgba(12,10,18,0.9)"]} deg={170} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.glint} pointerEvents="none" />

            <View style={styles.recipientRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flex: 1 }}>
                {recipients.map((r, i) => (
                  <Pressable key={r.name} onPress={() => setTarget(i + 1)} style={[styles.recip, { borderColor: target === i + 1 ? C.gold : "transparent" }]}>
                    <Portrait name={r.name} size={40} ring={r.host ? C.gold : r.mod ? C.purple2 : "rgba(255,255,255,.18)"} />
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable onPress={() => setTarget(0)} style={{ borderRadius: 999, overflow: "hidden" }}>
                {target === 0 ? (
                  <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.allBtn}>
                    <Txt weight="extrabold" size={12} color="#fff">Tümü</Txt>
                  </Gradient>
                ) : (
                  <View style={[styles.allBtn, { backgroundColor: "rgba(255,255,255,.08)" }]}>
                    <Txt weight="extrabold" size={12} color="#fff">Tümü</Txt>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.levelRow}>
              <Txt weight="displayBold" size={13} color={C.gold2}>LV.1</Txt>
              <View style={{ flex: 1 }}>
                <View style={styles.levelTrack}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={{ width: "32%", height: "100%", borderRadius: 6 }} />
                </View>
                <Txt weight="semibold" size={9.5} color={C.dim} style={{ marginTop: 4 }}>Kalan 5000 EXP · LV.2'ye yükseltilecek</Txt>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {GIFT_TABS.map((t, i) => (
                <Pressable key={t} onPress={() => { setTab(i); setSel(null); }} style={{ paddingVertical: 10, paddingBottom: 11 }}>
                  <Txt weight={i === tab ? "extrabold" : "semibold"} size={13} color={i === tab ? C.gold : C.dim}>{t}</Txt>
                  {i === tab && <View style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.grid}>
              {list.map((g) => {
                const on = sel === g.id;
                return (
                  <Pressable key={g.id} onPress={() => setSel(g.id)} style={[styles.giftCell, on && styles.giftCellOn]}>
                    <GiftIcon gift={g} size={54} />
                    <Txt weight="bold" size={10} color={C.text} numberOfLines={1} align="center" style={{ marginTop: 5, maxWidth: 70 }}>{g.name}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <DiamondBadge size={11} />
                      <Txt weight="extrabold" size={10} color={C.gold}>{g.price.toLocaleString("tr-TR")}</Txt>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <DiamondBadge size={16} />
                <Txt weight="extrabold" size={13} color="#22D3EE">{coins.toLocaleString("tr-TR")}</Txt>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setQtyIdx((q) => (q + 1) % QTY.length)} style={styles.qtyChip}>
                <Txt weight="extrabold" size={13} color={C.text}>{qty}</Txt>
                <Icon name="chev" size={12} color={C.dim} />
              </Pressable>
              <Pressable
                disabled={!selGift}
                onPress={() => selGift && onSend(selGift, qty, target === 0 ? "Herkese" : recipients[target - 1]?.name || "Herkese")}
                style={{ borderRadius: 999, overflow: "hidden", opacity: selGift ? 1 : 0.5 }}
              >
                <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.sendBtn}>
                  <Txt weight="extrabold" size={14} color="#fff">Gönder</Txt>
                </Gradient>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.5)" },
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    backgroundColor: "rgba(18,14,26,0.6)",
  },
  glint: { position: "absolute", top: 0, left: 40, right: 40, height: 1, backgroundColor: "rgba(255,255,255,.5)" },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 16 },
  recip: { borderRadius: 999, padding: 2, borderWidth: 2 },
  allBtn: { paddingVertical: 9, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  levelRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  levelTrack: { height: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,.08)", overflow: "hidden" },
  tabs: { gap: 18, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.07)" },
  tabUnderline: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 4, backgroundColor: C.gold },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 6 },
  giftCell: { width: "23%", alignItems: "center", paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  giftCellOn: { backgroundColor: "rgba(124,58,237,.18)", borderColor: C.purple2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.07)" },
  qtyChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16 },
  sendBtn: { paddingVertical: 12, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
});
