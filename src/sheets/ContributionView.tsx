import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Txt } from "@/components/Txt";
import { type Seat } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export function ContributionView({
  occupants,
  host,
  onClose,
  onOpenUser,
}: {
  occupants: Seat[];
  host: string;
  onClose: () => void;
  onOpenUser: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(1);

  const names = occupants.map((o) => o.name).filter((n) => n && n !== "Sen");
  const seed7 = [90, 48, 32, 21, 14, 9, 6, 3];
  const seed24 = [12, 7, 4, 2, 1];
  const build = (seed: number[]) =>
    names
      .map((n, i) => ({ name: n, val: seed[i] !== undefined ? seed[i] : Math.max(0, 5 - i) }))
      .filter((x) => x.val > 0)
      .sort((a, b) => b.val - a.val);
  const list = tab === 1 ? build(seed7) : build(seed24);
  const total = list.reduce((s, x) => s + x.val, 0);
  const top = list[0];
  const rest = list.slice(1);
  const myVal = tab === 1 ? 7 : 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            <Gradient colors={["#241B0A", "#0A0810"]} deg={150} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <Icon name="x" size={18} color={C.text} />
              </Pressable>
              <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1, textAlign: "center", marginLeft: -34 }}>Katkı</Txt>
            </View>

            <View style={styles.tabs}>
              {["Son 24 Saat", "Son 7 Gün"].map((t, i) => (
                <Pressable key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
                  <Txt weight={i === tab ? "extrabold" : "medium"} size={14.5} color={i === tab ? "#fff" : "rgba(255,255,255,.4)"}>{t}</Txt>
                  {i === tab && <View style={styles.tabUnderline} />}
                </Pressable>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
                <View style={styles.totalPill}>
                  <Txt size={15}>🏆</Txt>
                  <Txt weight="displayBold" size={14} color="#fff">{total}</Txt>
                </View>
                <Txt weight="semibold" size={11.5} color={C.dim}>Güncelleme: 21:44</Txt>
              </View>

              {top ? (
                <>
                  <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 8 }}>
                    <Pressable onPress={() => onOpenUser(top.name)} style={{ alignItems: "center" }}>
                      <Txt size={30} style={{ marginBottom: -14, zIndex: 2 }}>👑</Txt>
                      <Portrait name={top.name} size={96} ring={C.gold} glow />
                      <View style={styles.top1}>
                        <Txt weight="displayBold" size={13} color="#7C2D12" style={{ letterSpacing: 0.5 }}>TOP.1</Txt>
                      </View>
                    </Pressable>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 18 }}>
                      <Txt weight="displayBold" size={17} color="#fff">{top.name}</Txt>
                      <Badge type="vip" size={17} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 }}>
                      <Txt size={12} color={C.dim}>Katkıda Bulundu:</Txt>
                      <DiamondBadge size={15} />
                      <Txt weight="displayBold" size={15} color={C.gold2}>{top.val}</Txt>
                    </View>
                  </View>

                  <View style={{ paddingTop: 8 }}>
                    {rest.map((r, i) => (
                      <Pressable key={r.name} onPress={() => onOpenUser(r.name)} style={styles.rankRow}>
                        <Txt weight="displayBold" size={15} color={i < 2 ? C.gold2 : C.dim} style={{ width: 18 }}>{i + 2}</Txt>
                        <Portrait name={r.name} size={42} ring="rgba(255,255,255,.14)" online />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{r.name}</Txt>
                            {r.name === host && <RolePill type="host" />}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <DiamondBadge size={13} />
                            <Txt weight="extrabold" size={12} color={C.gold2}>{r.val}</Txt>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 70 }}>Bu dönemde henüz katkı yok.</Txt>
              )}
            </ScrollView>

            <View style={[styles.myRank, { paddingBottom: 14 + insets.bottom }]}>
              <Txt weight="displayBold" size={14} color={C.dim} style={{ width: 18 }}>—</Txt>
              <Portrait name="Sen" size={42} ring={C.gold} />
              <View style={{ flex: 1 }}>
                <Txt weight="extrabold" size={13} color="#fff">Sen</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <DiamondBadge size={13} />
                  <Txt weight="extrabold" size={12} color={C.gold2}>{myVal}</Txt>
                </View>
              </View>
              <Txt size={10.5} color={C.dim2}>Katkın</Txt>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: { height: "82%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)", backgroundColor: "#0A0810" },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 24, marginTop: 6 },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  tabUnderline: { position: "absolute", bottom: -1, width: 30, height: 3, borderRadius: 3, backgroundColor: "#22D3EE" },
  totalPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 7, paddingLeft: 10, paddingRight: 14, borderRadius: 999, backgroundColor: "rgba(124,58,237,.3)", borderWidth: 1, borderColor: "rgba(168,85,247,.3)" },
  top1: { position: "absolute", bottom: -8, paddingVertical: 3, paddingHorizontal: 18, borderRadius: 6, backgroundColor: "#F59E0B", borderWidth: 1.5, borderColor: "#FDE68A" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.05)" },
  myRank: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(10,8,16,.96)" },
});
