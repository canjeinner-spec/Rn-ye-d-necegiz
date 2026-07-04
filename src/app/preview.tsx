import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BadgeRow } from "@/components/BadgeRow";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Eq } from "@/components/Eq";
import { IdNameplate, NAMEPLATE_FRAMES } from "@/components/IdNameplate";
import { IdKapsul, OzelIdKart } from "@/components/OzelId";
import { Pill } from "@/components/Pill";
import { PngBadge, type PngBadgeName } from "@/components/PngBadge";
import { OZEL_ID_KARTLARI } from "@/data/specialId";
import { Portrait } from "@/components/Portrait";
import { RolePill } from "@/components/RolePill";
import { Scene } from "@/components/Scene";
import { SearchBar } from "@/components/SearchBar";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { type BadgeItem } from "@/data/badges";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { GlassPanel } from "@/theme/GlassPanel";
import { Gradient } from "@/theme/Gradient";

const DEMO_BADGES: BadgeItem[] = [
  { type: "developer" },
  { type: "vip" },
  { type: "level", lvl: 42 },
  { type: "streamer" },
  { type: "member" },
  { type: "agency", meta: { id: "AJ-001", name: "Aron Stars", owner: "Ardaowski" } },
];

const PEOPLE_NAMES = ["Mervee", "Zeno Sv.", "Lunas", "Ender", "Furkan", "Sen"];

const DEMO_PNG_BADGES: PngBadgeName[] = [
  "role_developer", "role_super_admin", "role_admin", "role_moderator", "role_streamer",
  "role_vip", "role_vip_hukumdar", "level_bronze", "level_silver", "level_gold",
  "level_platinum", "level_diamond", "level_legendary", "special_beta_tester",
];

const DEMO_IDS = ["ARDA", "888888", "ARON", "V.I.P", "100000", "ZENO"];

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

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Rozetler & rol
          </Txt>
          <View style={{ paddingHorizontal: 18, gap: 12 }}>
            <BadgeRow badges={DEMO_BADGES} size={30} />
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <RolePill type="host" />
              <RolePill type="mod" />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <CoinBadge size={18} />
                <Txt weight="extrabold" size={12} color={C.gold2}>
                  12.4K
                </Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <DiamondBadge size={18} />
                <Txt weight="extrabold" size={12} color="#67E8F9">
                  860
                </Txt>
              </View>
            </View>
          </View>

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Scene (oda atmosferi)
          </Txt>
          <View style={styles.sceneRow}>
            {(["official", "club", "lounge", "night", "fire"] as const).map((k) => (
              <View key={k} style={styles.sceneCard}>
                <Scene kind={k} />
                <Txt weight="extrabold" size={10} color="#fff" style={styles.sceneLabel}>
                  {k}
                </Txt>
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

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Premium rozetler (normalize — tıkla → bilgi kartı)
          </Txt>
          <View style={styles.rowWrap}>
            {DEMO_PNG_BADGES.map((n) => (
              <PngBadge key={n} name={n} size={40} />
            ))}
          </View>

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            ÖZEL ID hiyerarşisi (basamak sayısına göre)
          </Txt>
          <View style={{ paddingHorizontal: 18, gap: 8 }}>
            <Txt weight="semibold" size={11} color={C.dim2}>≤5 basamak → premium kart (admin atar):</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <OzelIdKart frame="gold" id="88888" width={210} />
              <OzelIdKart frame="celestial" id="54321" width={210} />
              <OzelIdKart frame="dragon" id="100" width={210} />
            </View>
            <Txt weight="semibold" size={11} color={C.dim2} style={{ marginTop: 6 }}>6–7 basamak → temaya renk-uyumlu kapsül:</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <IdKapsul theme="gold" id="123456" />
              <IdKapsul theme="dragon" id="1234567" />
              <IdKapsul theme="ice" id="654321" />
              <IdKapsul theme="emerald" id="998877" />
              <IdKapsul theme="demon" id="112233" />
              <IdKapsul theme="cyber" id="456789" />
            </View>
          </View>

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            25 ÖZEL ID kart teması (kırpım onayı)
          </Txt>
          <View style={{ paddingHorizontal: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {OZEL_ID_KARTLARI.map((k) => (
              <OzelIdKart key={k} frame={k} id="12345" width={160} />
            ))}
          </View>

          <Txt weight="bold" size={13} color={C.dim} style={styles.label}>
            Nameplate çerçeveleri ({NAMEPLATE_FRAMES.length})
          </Txt>
          <View style={{ paddingHorizontal: 18, gap: 10 }}>
            {NAMEPLATE_FRAMES.map((f, i) => (
              <IdNameplate key={f} frame={f} text={DEMO_IDS[i % DEMO_IDS.length]} width={280} />
            ))}
          </View>
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
  sceneRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, flexWrap: "wrap" },
  sceneCard: { width: 96, height: 64, borderRadius: 14, overflow: "hidden", justifyContent: "flex-end" },
  sceneLabel: { margin: 8 },
});
