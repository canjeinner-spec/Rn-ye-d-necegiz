import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const LV = 12;
const XP = 2020;
const NEED = 1180;
const PCT = Math.round((XP / (XP + NEED)) * 100);
const R = 52;
const CIRC = 2 * Math.PI * R;
const DASH = CIRC * (PCT / 100);

const WAYS: { ic: IconName; t: string; s: string; val: string }[] = [
  { ic: "mic", t: "Odada Kal", s: "10 dakika / 10 Tecrübe", val: "0/300" },
  { ic: "crown", t: "Hediye Gönder", s: "Aldığın & verdiğin hediyeler", val: "0/300" },
  { ic: "chat", t: "Sohbet Et", s: "Aktif sohbet · 5 mesaj / 2 Tecrübe", val: "0/200" },
];

export default function LevelScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Seviye</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.ringWrap}>
            <Svg width={148} height={148} viewBox="0 0 148 148" style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
              <Defs>
                <LinearGradient id="lvlG" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#FFF1B8" />
                  <Stop offset="1" stopColor="#D69A2E" />
                </LinearGradient>
              </Defs>
              <Circle cx={74} cy={74} r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={5} />
              <Circle cx={74} cy={74} r={R} fill="none" stroke="url(#lvlG)" strokeWidth={5} strokeLinecap="round" strokeDasharray={[DASH, CIRC]} />
            </Svg>
            <Portrait name="Sen" size={112} ring={C.gold} glow />
            <Gradient colors={["#F5CE6E", "#C8922B"]} deg={135} style={styles.lvBand}>
              <Txt weight="displayBold" size={13} color="#3A2A05">LV.{LV}</Txt>
            </Gradient>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40, paddingTop: 10 }}>
            <Txt weight="bold" size={12} color={C.dim}>LV.{LV}</Txt>
            <Txt weight="bold" size={12} color={C.dim}>LV.{LV + 1}</Txt>
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
            <View style={styles.barBg}>
              <Gradient colors={["#F5CE6E", "#C8922B"]} deg={90} style={[styles.barFill, { width: `${PCT}%` }]} />
            </View>
          </View>

          <View style={styles.xpCard}>
            <View style={styles.xpCol}>
              <Txt weight="displayBold" size={19} color={C.gold2}>{XP.toLocaleString("tr-TR")}</Txt>
              <Txt weight="semibold" size={10} color={C.dim} style={{ marginTop: 3 }}>Güncel Tecrübe</Txt>
            </View>
            <View style={styles.xpDivider} />
            <View style={styles.xpCol}>
              <Txt weight="displayBold" size={19} color="#fff">{NEED.toLocaleString("tr-TR")}</Txt>
              <Txt weight="semibold" size={10} color={C.dim} style={{ marginTop: 3 }}>Sonraki Level İçin</Txt>
            </View>
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <View style={styles.qMark}>
                <Txt weight="displayBold" size={13} color={C.gold2}>?</Txt>
              </View>
              <Txt weight="displayBold" size={15} color="#fff">Yüksek Level Avantajları</Txt>
            </View>
            <View style={{ paddingLeft: 4, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Txt weight="bold" size={12} color="#5EEAD4">1.</Txt>
                <Txt size={12} color={C.dim} lh={1.65} style={{ flex: 1 }}>0–5 seviyelerinde her level atladığında elmas, 6. seviyeden itibaren her level atladığında altın kazanırsın.</Txt>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Txt weight="bold" size={12} color="#5EEAD4">2.</Txt>
                <Txt size={12} color={C.dim} lh={1.65} style={{ flex: 1 }}>Seviyen arttıkça odalarda daha çok dikkat çeker, sıralamalarda öne geçersin.</Txt>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <Icon name="crown" size={18} color={C.gold} />
              <Txt weight="displayBold" size={15} color="#fff">Nasıl Level Atlarım</Txt>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", paddingLeft: 4, marginBottom: 6 }}>
              <Txt size={11.5} color={C.dim} lh={1.6}>Aron VIP üyesi değilsin; seviyen standart hızda artıyor. (Bugünün üst limiti: </Txt>
              <Txt weight="bold" size={11.5} color="#FB7185">650</Txt>
              <Txt size={11.5} color={C.dim}> Tecrübe)</Txt>
            </View>
            {WAYS.map((w, i) => (
              <View key={i} style={styles.wayRow}>
                <View style={styles.wayIcon}>
                  <Icon name={w.ic} size={16} color={C.gold2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>{w.t}</Txt>
                  <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>{w.s}</Txt>
                </View>
                <Txt weight="extrabold" size={11} color={C.dim2}>{w.val}</Txt>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  ringWrap: { width: 148, height: 148, alignSelf: "center", marginTop: 14, marginBottom: 6, alignItems: "center", justifyContent: "center" },
  lvBand: { position: "absolute", bottom: -2, paddingVertical: 4, paddingHorizontal: 18, borderRadius: 8 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.1)", overflow: "hidden" },
  barFill: { height: "100%" },
  xpCard: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", overflow: "hidden" },
  xpCol: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 8 },
  xpDivider: { width: 1, backgroundColor: "rgba(255,255,255,.08)" },
  qMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}44`, alignItems: "center", justifyContent: "center" },
  wayRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginTop: 8 },
  wayIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}33` },
});
