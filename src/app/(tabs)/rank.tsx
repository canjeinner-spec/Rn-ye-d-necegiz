import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { Badge } from "@/components/Badge";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Pill } from "@/components/Pill";
import { PngBadge, type PngBadgeName } from "@/components/PngBadge";
import { Portrait } from "@/components/Portrait";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { AGENCY_RANKS, RANKS, STREAMER_RANKS } from "@/data/seed";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const MEDAL: Record<number, string> = { 1: C.gold, 2: "#C7CCD6", 3: "#C9803B" };
const PLACE_BADGE: Record<number, PngBadgeName> = { 1: "room_weekly_champion", 2: "room_rank_silver", 3: "room_rank_bronze" };

function ScorePill({ icon, value, faint }: { icon: "coin" | "diamond"; value: string; faint?: boolean }) {
  return (
    <Pill bg={C.gold + (faint ? "10" : "14")} color={C.gold} border={C.gold + (faint ? "26" : "33")} style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {icon === "coin" ? <CoinBadge size={12} /> : <DiamondBadge size={12} />}
        <Txt weight="extrabold" size={10} color={C.gold}>{value}</Txt>
      </View>
    </Pill>
  );
}

export default function RankTab() {
  const [tab, setTab] = useState(0);
  const podium = [RANKS[1], RANKS[0], RANKS[2]];

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
          <Txt weight="displayBold" size={17} color="#fff" style={{ letterSpacing: 0.5 }}>Sıralama</Txt>
          <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>Haftalık liste · 2g 14s kaldı</Txt>
        </View>

        <Tabs items={["Zenginlik", "Cazibe", "Odalar", "Ajanslar", "Yayıncılar"]} active={tab} set={setTab} pad={14} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {tab === 3 ? (
            AGENCY_RANKS.map((a, i) => (
              <View key={a.name} style={[styles.row, { borderColor: i < 3 ? C.gold + "40" : C.line }]}>
                <Txt weight="extrabold" size={14} color={i === 0 ? C.gold : i < 3 ? "#C7CCD6" : C.dim} style={{ width: 20 }}>{i + 1}</Txt>
                <AgencyEmblem s={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{a.name}</Txt>
                  <Txt weight="semibold" size={10} color={C.dim} style={{ marginTop: 2 }}>{a.owner} · {a.members} üye</Txt>
                </View>
                <ScorePill icon="diamond" value={a.score} />
              </View>
            ))
          ) : tab === 4 ? (
            STREAMER_RANKS.map((s, i) => (
              <View key={s.name} style={[styles.row, { borderColor: i < 3 ? C.green + "40" : C.line }]}>
                <Txt weight="extrabold" size={14} color={i === 0 ? C.gold : i < 3 ? "#C7CCD6" : C.dim} style={{ width: 20 }}>{i + 1}</Txt>
                <Portrait name={s.name} size={42} ring={i < 3 ? C.green : undefined} online />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Txt weight="extrabold" size={13} color={C.text}>{s.name}</Txt>
                    <Badge type="streamer" size={15} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <AgencyEmblem s={12} />
                    <Txt weight="semibold" size={10} color={C.dim}>{s.agency}</Txt>
                  </View>
                </View>
                <ScorePill icon="coin" value={s.coins} faint />
              </View>
            ))
          ) : (
            <>
              <View style={styles.podium}>
                {podium.map((p, i) => {
                  const place = [2, 1, 3][i];
                  const big = place === 1;
                  return (
                    <View key={p.name} style={{ alignItems: "center", gap: 6 }}>
                      <PngBadge name={PLACE_BADGE[place]} size={big ? 60 : 44} />
                      <Portrait name={p.name} size={big ? 72 : 54} ring={MEDAL[place]} glow={big} />
                      <Txt weight="extrabold" size={12} color="#fff">{p.name}</Txt>
                      <ScorePill icon="coin" value={p.coins} />
                      <Gradient
                        colors={[MEDAL[place] + "cc", MEDAL[place] + "22"]}
                        deg={180}
                        style={{ width: big ? 62 : 48, height: big ? 38 : 24, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: "center", justifyContent: "center" }}
                      >
                        <Txt weight="extrabold" size={15} color="#0E0B12">{place}</Txt>
                      </Gradient>
                    </View>
                  );
                })}
              </View>
              {RANKS.slice(3).map((p, i) => (
                <View key={p.name} style={[styles.row, { borderColor: C.line }]}>
                  <Txt weight="extrabold" size={12.5} color={C.dim} style={{ width: 18 }}>{i + 4}</Txt>
                  <Portrait name={p.name} size={40} />
                  <Txt weight="extrabold" size={12.5} color={C.text} style={{ flex: 1 }}>{p.name}</Txt>
                  <ScorePill icon="coin" value={p.coins} faint />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 9 },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 18, paddingTop: 16, paddingBottom: 20 },
});
