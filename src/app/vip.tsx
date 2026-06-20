import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { VipEmblem } from "@/components/VipEmblem";
import { VIP_PERKS, VIP_TIERS, type VipTierKey } from "@/data/vip";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const KEYS: VipTierKey[] = ["asil", "hukumdar"];

export default function VipScreen() {
  const router = useRouter();
  const [tier, setTier] = useState<VipTierKey>("hukumdar");
  const t = VIP_TIERS[tier];

  return (
    <View style={styles.root}>
      <Gradient colors={[tier === "hukumdar" ? "#1E1330" : "#241A0E", "#07070B"]} deg={180} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Aron <Txt weight="displayBold" size={16} color={C.gold}>VIP</Txt></Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.status}>
          <Portrait name="Sen" size={40} ring={t.color} />
          <Txt weight="bold" size={12.5} color={C.text}>Henüz Aron VIP üyesi değilsin.</Txt>
        </View>

        <View style={styles.tierTabs}>
          {KEYS.map((k) => {
            const v = VIP_TIERS[k];
            const on = tier === k;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTier(k); }} style={styles.tierTab}>
                <Txt weight="extrabold" size={15} color={on ? "#fff" : C.dim}>{v.name}</Txt>
                {on && (
                  <Gradient colors={v.grad} deg={90} style={styles.tierUnderline} />
                )}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.divider} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center" }}>
            <VipEmblem tier={tier} s={130} />
            <Txt weight="displayBold" size={22} color="#fff" style={{ marginTop: 4, letterSpacing: 0.5 }}>{t.name}</Txt>
          </View>

          <View style={styles.perkHead}>
            <Gradient colors={["transparent", `${t.color}66`]} deg={90} style={styles.perkLine} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="crown" size={16} color={t.color} />
              <Txt weight="extrabold" size={13} color={t.color}>Ayrıcalıklar</Txt>
            </View>
            <Gradient colors={[`${t.color}66`, "transparent"]} deg={90} style={styles.perkLine} />
          </View>
          <Txt weight="bold" size={11.5} color={C.dim} align="center" style={{ marginBottom: 18 }}>({t.count}/14)</Txt>

          <View style={styles.perkGrid}>
            {VIP_PERKS.map((p, i) => {
              const locked = i >= t.count;
              const col = locked ? C.dim2 : t.color;
              return (
                <View key={i} style={[styles.perk, { opacity: locked ? 0.4 : 1 }]}>
                  <Icon path={p.d} size={34} sw={1.6} color={col} />
                  <Txt weight="extrabold" size={12.5} color={locked ? C.dim : C.text} align="center" style={{ marginTop: 8 }}>{p.t}</Txt>
                  <Txt size={10} color={C.dim} align="center" lh={1.4} style={{ marginTop: 3 }}>{p.s}</Txt>
                  {locked && (
                    <View style={styles.lockBadge}>
                      <Icon name="lock" size={12} color={C.dim2} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 10 }}>
            <Txt weight="semibold" size={12} color={C.text}>Her ay </Txt>
            <DiamondBadge size={13} />
            <Txt weight="extrabold" size={12} color={t.color}>{t.monthly.toLocaleString("tr-TR")}</Txt>
            <Txt weight="semibold" size={12} color={C.text}> elmas kazanmak için abone ol</Txt>
          </View>
          <Pressable onPress={() => haptic.medium()} style={[styles.subBtn, { shadowColor: t.color }]}>
            <Gradient colors={t.grad} deg={90} style={styles.subInner}>
              <Txt weight="extrabold" size={14} color={tier === "hukumdar" ? "#fff" : "#241A05"}>{t.price} / ay için abone ol</Txt>
            </Gradient>
          </Pressable>
          <Txt size={9.5} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 10 }}>
            Aboneliğe tıklayarak Kullanım Şartları ve Gizlilik Politikası'nı kabul edersin.
          </Txt>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 6, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,.04)", borderRadius: 16 },
  tierTabs: { flexDirection: "row", marginHorizontal: 16, marginTop: 16 },
  tierTab: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tierUnderline: { position: "absolute", bottom: 0, width: 46, height: 3, borderRadius: 3 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,.08)", marginHorizontal: 16 },
  perkHead: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22, marginBottom: 4 },
  perkLine: { flex: 1, height: 1 },
  perkGrid: { flexDirection: "row", flexWrap: "wrap" },
  perk: { width: "50%", alignItems: "center", paddingHorizontal: 6, marginBottom: 22 },
  lockBadge: { position: "absolute", top: -2, right: "50%", marginRight: -22 },
  bottomBar: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  subBtn: { borderRadius: 15, overflow: "hidden", shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  subInner: { paddingVertical: 15, alignItems: "center" },
});
