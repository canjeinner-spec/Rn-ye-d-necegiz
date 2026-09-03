import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { GIFT_BY_ID, GIFT_LOG } from "@/data/giftHistory";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : String(n));
const valueOf = (rows: { gid: string; qty: number }[]) =>
  rows.reduce((s, r) => s + (GIFT_BY_ID[r.gid]?.price ?? 0) * r.qty, 0);

export default function GiftHistoryScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const rows = tab === 0 ? GIFT_LOG.received : GIFT_LOG.sent;
  const totalIn = valueOf(GIFT_LOG.received);
  const totalOut = valueOf(GIFT_LOG.sent);

  return (
    <View style={styles.root}>
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Hediye Geçmişi</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.summary}>
          <View style={[styles.sumCard, { borderColor: C.green + "3D" }]}>
            <Txt weight="bold" size={10.5} color="#6EE7B7">Toplam Alınan</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <DiamondBadge size={16} />
              <Txt weight="displayBold" size={21} color="#fff">{fmt(totalIn)}</Txt>
            </View>
          </View>
          <View style={[styles.sumCard, { borderColor: C.gold + "3D" }]}>
            <Txt weight="bold" size={10.5} color={C.gold2}>Toplam Gönderilen</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <DiamondBadge size={16} />
              <Txt weight="displayBold" size={21} color="#fff">{fmt(totalOut)}</Txt>
            </View>
          </View>
        </View>

        <Tabs items={["Alınan", "Gönderilen"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {rows.map((r, i) => {
            const g = GIFT_BY_ID[r.gid] ?? { emoji: "🎁", name: "Hediye", price: 0, c1: "#FDE68A", c2: "#B45309" };
            const peer = tab === 0 ? r.from : r.to;
            const value = g.price * r.qty;
            return (
              <View key={i} style={styles.row}>
                <View style={[styles.giftIcon, { borderColor: `${g.c1}40` }]}>
                  <Gradient colors={[`${g.c1}33`, `${g.c2}22`]} deg={150} style={StyleSheet.absoluteFill} />
                  <Txt size={24}>{g.emoji}</Txt>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Txt weight="extrabold" size={13.5} color={C.text}>{g.name}</Txt>
                    <Txt weight="bold" size={11.5} color={C.gold2}>×{r.qty}</Txt>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <Txt weight="bold" size={11} color={tab === 0 ? "#6EE7B7" : C.gold2}>{tab === 0 ? "Gönderen:" : "Alıcı:"}</Txt>
                    <Txt size={11} color={C.dim}>{peer}</Txt>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Txt weight="extrabold" size={13} color={tab === 0 ? "#34D399" : "#F472B6"}>{tab === 0 ? "+" : "−"}</Txt>
                    <DiamondBadge size={13} />
                    <Txt weight="extrabold" size={13} color={tab === 0 ? "#34D399" : "#F472B6"}>{fmt(value)}</Txt>
                  </View>
                  <Txt weight="semibold" size={10} color={C.dim2} style={{ marginTop: 3 }}>{r.when}</Txt>
                </View>
              </View>
            );
          })}
          <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Son 30 günün hediye geçmişi gösteriliyor</Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  summary: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 8 },
  sumCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, backgroundColor: "rgba(255,255,255,.045)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  giftIcon: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
});
