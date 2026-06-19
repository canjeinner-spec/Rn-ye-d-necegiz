import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Eq } from "@/components/Eq";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { SearchBar } from "@/components/SearchBar";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { GlassPanel } from "@/theme/GlassPanel";
import { Gradient } from "@/theme/Gradient";

const PEOPLE_NAMES = ["Mervee", "Zeno Sv.", "Lunas", "Ender", "Furkan", "Sen"];

/**
 * Geçici temel-katman önizlemesi. Navigasyon iskeleti (Aşama 2) ile değiştirilecek.
 * Portrait / Eq / Icon / Pill / Tabs / GlassPanel'i görsel olarak doğrular.
 */
export default function Index() {
  const [tab, setTab] = useState(0);
  return (
    <View style={styles.root}>
      <Gradient colors={["#17121F", "#050507"]} deg={180} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Txt weight="displayBold" size={26} color={C.gold} style={{ letterSpacing: 1 }}>
            ARON
          </Txt>
          <Eq />
        </View>

        <Tabs items={["Temel", "Önizleme", "Bileşenler"]} active={tab} set={setTab} />
        <SearchBar placeholder="Kişi, oda veya ID ara…" />

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Portrait (silüet + foto fallback)
          </Txt>
          <View style={styles.row}>
            {PEOPLE_NAMES.map((n, i) => (
              <Portrait
                key={n}
                name={n}
                size={56}
                ring={i % 2 ? C.gold : C.purple2}
                glow
                online={i < 3}
                muted={i === 4}
              />
            ))}
          </View>

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Pill & Icon
          </Txt>
          <View style={styles.rowWrap}>
            <Pill bg={C.gold} color="#1A1206">
              VIP
            </Pill>
            <Pill bg="rgba(139,92,246,.2)" color={C.purple2} border={C.purple}>
              Lv 42
            </Pill>
            <Pill bg="rgba(52,211,153,.15)" color={C.green}>
              Çevrimiçi
            </Pill>
            {(["home", "mic", "gift", "chat", "heart", "crown", "trophy", "bell"] as const).map((nm) => (
              <View key={nm} style={styles.iconChip}>
                <Icon name={nm} size={20} color={C.gold2} />
              </View>
            ))}
          </View>

          <GlassPanel style={styles.panel} radius={20}>
            <Txt weight="bold" size={14}>
              Liquid Glass panel
            </Txt>
            <Txt weight="medium" size={11.5} color={C.dim} style={{ marginTop: 4 }}>
              BlurView + gradyan + glint çizgisi
            </Txt>
          </GlassPanel>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  label: { marginTop: 22, marginBottom: 10, marginHorizontal: 18 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 18, flexWrap: "wrap" },
  rowWrap: { flexDirection: "row", gap: 10, paddingHorizontal: 18, flexWrap: "wrap", alignItems: "center" },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: { margin: 18, marginTop: 24, padding: 20 },
});
