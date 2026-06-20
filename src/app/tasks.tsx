import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Txt } from "@/components/Txt";
import { DAILY_REWARDS, TASKS } from "@/data/tasks";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export default function TasksScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [claimed, setClaimed] = useState(false);

  return (
    <View style={styles.root}>
      <Gradient colors={["#1E1330", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Görevler</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.tabs}>
          {["Günlük Giriş", "Görevler"].map((t, i) => (
            <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={{ flex: 1, borderRadius: 11, overflow: "hidden" }}>
              {i === tab ? (
                <Gradient colors={["#7C3AED", "#5B21B6"]} deg={135} style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color="#fff">{t}</Txt>
                </Gradient>
              ) : (
                <View style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color={C.dim}>{t}</Txt>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <Gradient colors={["rgba(124,58,237,.2)", "rgba(34,211,238,.12)"]} deg={150} style={styles.dailyCard}>
                <Txt weight="displayBold" size={15} color="#fff">Günlük Giriş Ödülü</Txt>
                <Txt size={11} color="rgba(255,255,255,.65)" style={{ marginTop: 4 }}>Her gün giriş yap, 7. günde büyük ödülü kap.</Txt>
                <View style={styles.dailyGrid}>
                  {DAILY_REWARDS.map((d) => (
                    <View
                      key={d.day}
                      style={[
                        styles.dayCell,
                        { width: d.big ? "100%" : "22%" },
                        { backgroundColor: d.done ? `${C.green}1A` : d.today ? `${C.gold}1A` : "rgba(255,255,255,.04)", borderColor: d.done ? `${C.green}44` : d.today ? C.gold : "rgba(255,255,255,.08)" },
                      ]}
                    >
                      <Txt weight="bold" size={9} color={C.dim}>{d.day}. Gün</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginVertical: 5 }}>
                        <DiamondBadge size={d.big ? 20 : 16} />
                        <Txt weight="displayBold" size={d.big ? 15 : 12.5} color={d.big ? C.gold2 : "#A5F3FC"}>{d.dia}</Txt>
                      </View>
                      {d.done ? (
                        <Txt weight="extrabold" size={8.5} color={C.green}>✓ Alındı</Txt>
                      ) : d.today ? (
                        <Txt weight="extrabold" size={8.5} color={C.gold2}>Bugün</Txt>
                      ) : (
                        <Txt weight="bold" size={8.5} color={C.dim2}>—</Txt>
                      )}
                    </View>
                  ))}
                </View>
              </Gradient>
              <Pressable onPress={() => { if (!claimed) { haptic.success(); setClaimed(true); } }} disabled={claimed} style={{ marginTop: 16, borderRadius: 15, overflow: "hidden", opacity: claimed ? 0.55 : 1 }}>
                <Gradient colors={claimed ? ["#475569", "#334155"] : ["#22D3EE", "#0891B2"]} deg={135} style={styles.claimBtn}>
                  <Txt weight="extrabold" size={14} color={claimed ? "#cbd5e1" : "#04252B"}>{claimed ? "Bugünün ödülü alındı ✓" : "3. Gün ödülünü al · 💎 15"}</Txt>
                </Gradient>
              </Pressable>
            </>
          ) : (
            TASKS.map((t, i) => (
              <View key={i} style={styles.taskRow}>
                <View style={styles.taskIcon}>
                  <Icon name={t.ic} size={17} color={C.purple2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>{t.t}</Txt>
                  <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>{t.s}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <DiamondBadge size={12} />
                    <Txt weight="extrabold" size={10.5} color="#A5F3FC">+{t.rew}</Txt>
                    <Txt weight="semibold" size={9.5} color={C.dim2} style={{ marginLeft: 4 }}>{t.prog}</Txt>
                  </View>
                </View>
                <Pressable onPress={() => t.done && haptic.success()} disabled={!t.done} style={{ borderRadius: 11, overflow: "hidden" }}>
                  {t.done ? (
                    <Gradient colors={["#22D3EE", "#0891B2"]} deg={135} style={styles.taskBtn}>
                      <Txt weight="extrabold" size={11} color="#04252B">Al</Txt>
                    </Gradient>
                  ) : (
                    <View style={[styles.taskBtn, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                      <Txt weight="extrabold" size={11} color={C.dim2}>Devam</Txt>
                    </View>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 6, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4 },
  tabInner: { paddingVertical: 9, alignItems: "center", borderRadius: 11 },
  dailyCard: { borderRadius: 20, padding: 16, paddingTop: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  dailyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  dayCell: { borderRadius: 13, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", borderWidth: 1 },
  claimBtn: { paddingVertical: 15, alignItems: "center" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginBottom: 9 },
  taskIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: `${C.purple}1A`, borderWidth: 1, borderColor: `${C.purple}44` },
  taskBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
