import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThroneCard } from "@/components/ThroneCard";
import { Txt } from "@/components/Txt";
import {
  SPECIAL_ID_DATA,
  THRONE_SUPER,
  THRONE_T2,
  tierBadgeColor,
  tierLabel,
  type SpecialTier,
} from "@/data/specialId";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const TIERS: SpecialTier[] = ["super", "t1", "t2"];

function TierBanner({ label }: { label: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.tierBanner}>
        <Txt size={11} color={C.gold2}>❧</Txt>
        <Txt weight="displayBold" size={13} color={C.gold2}>{label}</Txt>
        <Txt size={11} color={C.gold2}>☙</Txt>
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt size={12} color={C.gold}>◆◇</Txt>
      <Txt weight="displayBold" size={14.5} color={C.gold2} style={{ letterSpacing: 0.5 }}>{children}</Txt>
      <Txt size={12} color={C.gold}>◇◆</Txt>
    </View>
  );
}

function IdChip({ id, tier }: { id: string; tier: SpecialTier }) {
  return (
    <View style={styles.chip}>
      <Gradient colors={[tierBadgeColor(tier), `${tierBadgeColor(tier)}88`]} deg={135} style={styles.chipBadge}>
        <Txt weight="displayBold" size={8} color="#fff">ID</Txt>
      </Gradient>
      <Txt weight="displayBold" size={15} color={C.gold2} style={{ letterSpacing: 1 }}>{id}</Txt>
    </View>
  );
}

export default function SpecialIdScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);

  return (
    <View style={styles.root}>
      <Gradient colors={["#2A2012", "#0B0905"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.rulesBtn}>
            <Txt weight="bold" size={11} color={C.gold2}>Kurallar</Txt>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Txt weight="displayBold" size={34} color={C.gold2} style={{ letterSpacing: 2 }}>Özel ID</Txt>
        </View>

        <View style={styles.tabs}>
          {["Özel ID Havuzu", "Zenginler Sıralaması"].map((t, i) => {
            const on = i === tab;
            return (
              <Pressable
                key={t}
                onPress={() => { haptic.select(); setTab(i); }}
                style={[styles.tab, { borderTopLeftRadius: i === 0 ? 12 : 0, borderBottomLeftRadius: i === 0 ? 12 : 0, borderTopRightRadius: i === 1 ? 12 : 0, borderBottomRightRadius: i === 1 ? 12 : 0, overflow: "hidden" }]}
              >
                {on ? (
                  <Gradient colors={["#F5CE6E", "#C8922B"]} deg={180} style={styles.tabInner}>
                    <Txt weight="extrabold" size={12.5} color="#3A2A05">{t}</Txt>
                  </Gradient>
                ) : (
                  <View style={[styles.tabInner, { backgroundColor: "rgba(255,255,255,.04)" }]}>
                    <Txt weight="extrabold" size={12.5} color={C.dim}>{t}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              {TIERS.map((tier) => {
                const d = SPECIAL_ID_DATA[tier];
                return (
                  <View key={tier} style={{ marginTop: 18 }}>
                    <TierBanner label={tierLabel(tier)} />
                    <Txt weight="semibold" size={11.5} color={C.dim} align="center" style={{ marginTop: 12, marginBottom: 14 }}>
                      Aylık {d.gold} altın yükleyen kullanıcılar seçebilir
                    </Txt>
                    <View style={styles.idGrid}>
                      {d.ids.map((id) => <IdChip key={id} id={id} tier={tier} />)}
                    </View>
                    <Pressable onPress={() => haptic.light()} style={{ alignSelf: "center", marginTop: 14 }}>
                      <Txt weight="extrabold" size={12.5} color={C.gold2}>Yeni Grup ↻</Txt>
                    </Pressable>
                  </View>
                );
              })}

              <SectionTitle>Profilim</SectionTitle>
              <View style={styles.profileCard}>
                <View style={{ alignItems: "center" }}>
                  <Txt weight="bold" size={12} color={C.gold2}>Benim ID'm</Txt>
                  <Txt weight="displayBold" size={22} color="#fff" style={{ marginTop: 6, letterSpacing: 1 }}>4407</Txt>
                </View>
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <Txt weight="bold" size={12} color={C.gold2}>Benim Özel ID'm</Txt>
                  <Gradient colors={["transparent", `${C.gold}66`, "transparent"]} deg={90} style={styles.profileDivider} />
                  <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 8 }}>Henüz özel ID'n yok</Txt>
                </View>
                <View style={styles.statGrid}>
                  {([["Bu Ay Yüklenen Altın", "0"], ["Bu Ayki Seviye", "Yok"], ["Bu Ayki Sıralama", "0"], ["Geçen Ayki Seviye", "Yok"]] as const).map(([l, v]) => (
                    <View key={l} style={styles.statRow}>
                      <Txt weight="semibold" size={10.5} color={C.dim} style={{ flex: 1 }}>{l}</Txt>
                      <View style={styles.statVal}>
                        <Txt weight="extrabold" size={11.5} color={C.text}>{v}</Txt>
                      </View>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => { haptic.light(); router.navigate("/diamond-load"); }} style={{ marginTop: 18, borderRadius: 999, overflow: "hidden" }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.uploadBtn}>
                    <Txt weight="displayBold" size={14} color="#3A2A05" style={{ letterSpacing: 0.5 }}>Yükleme Yap</Txt>
                  </Gradient>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={{ marginTop: 20, marginBottom: 12 }}>
                <TierBanner label="Süper Özel ID" />
              </View>
              <View style={{ paddingHorizontal: 40 }}>
                <ThroneCard id={THRONE_SUPER.id} name={THRONE_SUPER.name} big />
              </View>

              <View style={{ marginTop: 24, marginBottom: 14 }}>
                <TierBanner label="2. Seviye Özel ID" />
              </View>
              <View style={styles.throneGrid}>
                {THRONE_T2.map((e) => (
                  <View key={e.id} style={{ width: "45%" }}>
                    <ThroneCard id={e.id} name={e.name} />
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
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  rulesBtn: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginHorizontal: 16 },
  tab: { flex: 1 },
  tabInner: { paddingVertical: 11, alignItems: "center" },
  tierBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 22, borderRadius: 8, backgroundColor: "#241805", borderWidth: 1.5, borderColor: `${C.gold}55` },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 22, marginBottom: 14 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(245,206,110,.1)", borderWidth: 1, borderColor: `${C.gold}33` },
  chipBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  profileCard: { borderRadius: 18, padding: 16, paddingVertical: 18, backgroundColor: "rgba(245,206,110,.06)", borderWidth: 1, borderColor: `${C.gold}33` },
  profileDivider: { alignSelf: "stretch", height: 2, marginTop: 8 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  statRow: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statVal: { minWidth: 54, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, alignItems: "center" },
  uploadBtn: { paddingVertical: 15, alignItems: "center" },
  throneGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18, columnGap: 14 },
});
