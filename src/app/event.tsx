import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge } from "@/components/Coins";
import { Txt } from "@/components/Txt";
import { COLLECT_CARDS, findBanner, KART_KRALI, RARE_RING } from "@/data/banners";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export default function EventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const b = findBanner(id);
  const [tab, setTab] = useState(0);
  const owned = COLLECT_CARDS.filter((c) => c.owned).length;

  return (
    <View style={styles.root}>
      <Gradient colors={[b.c1, "#0B0712"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color="#fff" />
          </Pressable>
          <Txt weight="displayBold" size={15} color="#fff" numberOfLines={1} style={{ flex: 1 }}>{b.title}</Txt>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <Gradient colors={[b.c2, b.c1]} deg={150} style={styles.hero}>
            <Gradient colors={["rgba(255,255,255,.3)", "rgba(255,255,255,0)"]} deg={160} locations={[0, 0.55]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Pressable onPress={() => haptic.light()} style={styles.rulesPill}>
              <Txt weight="extrabold" size={10.5} color="#3A2A05">Kurallar</Txt>
            </Pressable>
            <Txt size={40} style={{ marginBottom: 2 }}>🪽</Txt>
            <Txt weight="displayBold" size={24} color={b.accent} align="center" style={styles.heroTitle}>{b.title}</Txt>
            <View style={styles.kingTag}>
              <Txt weight="extrabold" size={10.5} color="#3A2A05">★ Kart Kralı ★</Txt>
            </View>
          </Gradient>

          {/* Kart Kralı — 3 top */}
          <View style={styles.kingRow}>
            {KART_KRALI.map((k) => (
              <View key={k.name} style={[styles.kingCard, { borderColor: k.c + "66" }]}>
                <Gradient colors={[k.c, k.c + "55"]} deg={160} style={styles.kingThumb}>
                  <Txt weight="displayBold" size={13} color="#fff">{k.name[0]}</Txt>
                </Gradient>
                <Txt weight="extrabold" size={10.5} color="#fff" numberOfLines={1} style={{ marginTop: 6 }}>{k.tag}</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
                  <CoinBadge size={11} />
                  <Txt weight="bold" size={10} color={C.gold2}>{k.val.toLocaleString("tr-TR")}</Txt>
                </View>
              </View>
            ))}
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {["Yıldız Kartlar", "Kart Albümü"].map((t, i) => {
              const on = i === tab;
              return (
                <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={{ flex: 1, borderRadius: 999, overflow: "hidden" }}>
                  {on ? (
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.tabInner}>
                      <Txt weight="extrabold" size={12.5} color="#3A2A05">{t}</Txt>
                    </Gradient>
                  ) : (
                    <View style={[styles.tabInner, styles.tabOff]}>
                      <Txt weight="extrabold" size={12.5} color={C.gold2}>{t}</Txt>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {tab === 0 ? (
            <>
              <Txt size={11} color="rgba(255,255,255,.7)" align="center" lh={1.5} style={{ paddingHorizontal: 24, marginBottom: 14 }}>
                Etkinlik boyunca kart çekmek için parçaları topla. 1 Parça: <Txt weight="bold" size={11} color={C.gold2}>100× Coins</Txt> (Parçalar görevlerle de toplanabilir)
              </Txt>
              <View style={styles.grid}>
                {COLLECT_CARDS.map((c) => (
                  <View key={c.id} style={[styles.card, { borderColor: RARE_RING[c.rare] }]}>
                    <Gradient colors={[c.c1, c.c2]} deg={155} style={styles.cardArt}>
                      <Txt weight="displayBold" size={30} color="rgba(255,255,255,.92)">{c.num}</Txt>
                    </Gradient>
                    <View style={{ padding: 9 }}>
                      <Txt weight="extrabold" size={12} color="#fff">{c.name}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <CoinBadge size={13} />
                        <Txt weight="bold" size={11} color={C.gold2}>{c.val}×</Txt>
                        <View style={{ flex: 1 }} />
                        <View style={[styles.rareDot, { backgroundColor: RARE_RING[c.rare] }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable onPress={() => haptic.medium()} style={styles.pullBtn}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.pullInner}>
                  <CoinBadge size={17} />
                  <Txt weight="extrabold" size={14} color="#3A2A05">Kart Çek · 100× Coins</Txt>
                </Gradient>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.albumHead}>
                <Txt weight="bold" size={12} color="rgba(255,255,255,.8)">Topladığın kartlar</Txt>
                <Txt weight="extrabold" size={13} color={C.gold2}>{owned}/{COLLECT_CARDS.length}</Txt>
              </View>
              <View style={styles.grid}>
                {COLLECT_CARDS.map((c) => (
                  <View key={c.id} style={[styles.card, { borderColor: c.owned ? RARE_RING[c.rare] : "rgba(255,255,255,.08)", opacity: c.owned ? 1 : 0.55 }]}>
                    <Gradient colors={c.owned ? [c.c1, c.c2] : ["#1F1B2A", "#15121C"]} deg={155} style={styles.cardArt}>
                      {c.owned ? (
                        <Txt weight="displayBold" size={30} color="rgba(255,255,255,.92)">{c.num}</Txt>
                      ) : (
                        <Icon name="lock" size={24} color="rgba(255,255,255,.4)" />
                      )}
                    </Gradient>
                    <View style={{ padding: 9 }}>
                      <Txt weight="extrabold" size={12} color={c.owned ? "#fff" : C.dim}>{c.name}</Txt>
                      <Txt weight="semibold" size={10} color={c.owned ? "#6EE7B7" : C.dim2} style={{ marginTop: 3 }}>{c.owned ? "✓ Toplandı" : "Henüz yok"}</Txt>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0712" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: 14, borderRadius: 22, paddingVertical: 22, paddingHorizontal: 18, alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  rulesPill: { position: "absolute", top: 12, right: 12, backgroundColor: C.gold2, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  heroTitle: { textShadowColor: "rgba(0,0,0,.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8, letterSpacing: 0.5 },
  kingTag: { marginTop: 12, backgroundColor: C.gold2, paddingVertical: 5, paddingHorizontal: 16, borderRadius: 8 },
  kingRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 16 },
  kingCard: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1 },
  kingThumb: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 20, marginBottom: 14 },
  tabInner: { paddingVertical: 12, alignItems: "center", borderRadius: 999 },
  tabOff: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1.5, borderColor: C.gold2 + "55" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  card: { width: "47%", flexGrow: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1.5, backgroundColor: "rgba(255,255,255,.03)" },
  cardArt: { height: 96, alignItems: "center", justifyContent: "center" },
  rareDot: { width: 8, height: 8, borderRadius: 4 },
  pullBtn: { marginHorizontal: 16, marginTop: 18, borderRadius: 16, overflow: "hidden" },
  pullInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  albumHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 12 },
});
