import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Tabs } from "@/components/Tabs";
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
      {/* Cüzdan ve profille aynı siyah-altın zemin; ekran mor (#1E1330) idi. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
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

        <Tabs items={["Günlük Giriş", "Görevler"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              {/* Kart artık cüzdandaki bakiye kartıyla aynı dil: siyah cam,
                  altın kenar, üstte ince parıltı ve köşede altın ışık. */}
              <View style={styles.dailyCard}>
                <Gradient colors={["rgba(232,179,65,.14)", "transparent"]} deg={155} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.cardSheen} pointerEvents="none" />
                <View style={styles.cardGlow} pointerEvents="none" />
                <Txt weight="displayBold" size={15} color="#fff">Günlük Giriş Ödülü</Txt>
                <Txt size={11} color={C.dim} style={{ marginTop: 4 }}>Her gün giriş yap, 7. günde büyük ödülü kap.</Txt>
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Icon name="check" size={9} sw={3.5} color={C.green} />
                          <Txt weight="extrabold" size={8.5} color={C.green}>Alındı</Txt>
                        </View>
                      ) : d.today ? (
                        <Txt weight="extrabold" size={8.5} color={C.gold2}>Bugün</Txt>
                      ) : (
                        <Txt weight="bold" size={8.5} color={C.dim2}>—</Txt>
                      )}
                    </View>
                  ))}
                </View>
              </View>
              {/* Emoji (✓ / 💎) yerine ikon ve gerçek elmas rozeti */}
              <Pressable onPress={() => { if (!claimed) { haptic.success(); setClaimed(true); } }} disabled={claimed} style={{ marginTop: 16, borderRadius: 15, overflow: "hidden", opacity: claimed ? 0.55 : 1 }}>
                {claimed ? (
                  <View style={[styles.claimBtn, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" }]}>
                    <Icon name="check" size={15} sw={3} color={C.dim} />
                    <Txt weight="extrabold" size={13.5} color={C.dim}>Bugünün ödülü alındı</Txt>
                  </View>
                ) : (
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.claimBtn}>
                    <Txt weight="extrabold" size={13.5} color="#241A05">3. Gün ödülünü al</Txt>
                    <DiamondBadge size={15} />
                    <Txt weight="extrabold" size={13.5} color="#241A05">15</Txt>
                  </Gradient>
                )}
              </Pressable>
            </>
          ) : (
            TASKS.map((t, i) => (
              <View key={i} style={styles.taskRow}>
                <View style={styles.taskIcon}>
                  <Icon name={t.ic} size={17} color={C.gold2} />
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
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.taskBtn}>
                      <Txt weight="extrabold" size={11} color="#241A05">Al</Txt>
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
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 230 },
  dailyCard: { borderRadius: 20, padding: 16, paddingTop: 18, borderWidth: 1, borderColor: C.gold + "3D", backgroundColor: "rgba(18,15,24,.72)", overflow: "hidden" },
  cardSheen: { position: "absolute", top: 0, left: 26, right: 26, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  cardGlow: { position: "absolute", right: -46, top: -56, width: 170, height: 170, borderRadius: 85, backgroundColor: C.gold + "1A" },
  dailyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  dayCell: { borderRadius: 13, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", borderWidth: 1 },
  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: 15 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 9 },
  taskIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D" },
  taskBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
