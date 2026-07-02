import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { VISITORS, type Visitor } from "@/data/visitors";
import { getMyVisitors } from "@/data/remote/visitRepo";
import { getCached, setCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

function VisitorRow({ v, i, onPress }: { v: Visitor; i: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Portrait name={v.name} size={48} ring={v.vip ? C.gold : undefined} glow={v.vip} online={i % 3 !== 0} photo={v.photo} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>{v.name}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Badge type="level" size={14} lvl={v.lv} />
            <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{v.lv}</Txt>
          </View>
          {v.vip && <Badge type="vip" size={15} />}
          <Icon name="male" size={12} color={v.gender === "k" ? "#F472B6" : "#60A5FA"} />
        </View>
        <Txt size={10.5} color={C.dim2} style={{ marginTop: 3 }}>{v.when} ziyaret etti</Txt>
      </View>
      <Icon name="chev" size={15} color={C.dim2} />
    </Pressable>
  );
}

function VisitorGroup({ list, keyOffset, onPress }: { list: Visitor[]; keyOffset: number; onPress: (v: Visitor) => void }) {
  return (
    <View style={styles.group}>
      {list.map((v, i) => (
        <View key={(v.publicId || v.name) + i}>
          {i > 0 && <View style={styles.divider} />}
          <VisitorRow v={v} i={i + keyOffset} onPress={() => onPress(v)} />
        </View>
      ))}
    </View>
  );
}

export default function VisitorsScreen() {
  const router = useRouter();
  const session = useApp((s) => s.session);
  const live = isSupabaseConfigured && !!session;
  // Cache-first: son ziyaretçi listesini anında göster (persist), arkada tazele.
  const [visitors, setVisitors] = useState<Visitor[]>(live ? (getCached<Visitor[]>("visitors:list") ?? []) : VISITORS);

  useFocusEffect(useCallback(() => {
    if (!live) return;
    let alive = true;
    getMyVisitors().then((v) => { if (alive) { setVisitors(v); setCached("visitors:list", v, true); } }).catch((e) => console.warn("[visitors]", e?.message || e));
    return () => { alive = false; };
  }, [live]));

  const today = visitors.filter((v) => v.today);
  const earlier = visitors.filter((v) => !v.today);
  const openProfile = (v: Visitor) => {
    haptic.light();
    const q = v.publicId ? `publicId=${encodeURIComponent(v.publicId)}&` : "";
    router.navigate(`/user-profile?${q}name=${encodeURIComponent(v.name)}`);
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#1E0E2E", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Ziyaretçiler</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            <Gradient colors={["#A855F7", "#7C3AED"]} deg={135} style={styles.summaryIcon}>
              <Icon name="eye" size={24} color="#fff" />
            </Gradient>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
                <Txt weight="displayBold" size={24} color="#fff">{visitors.length}</Txt>
                <Txt weight="bold" size={11.5} color="#C4B5FD">toplam ziyaretçi</Txt>
              </View>
              <View style={{ flexDirection: "row", marginTop: 3 }}>
                <Txt size={11} color={C.dim}>Bugün </Txt>
                <Txt weight="bold" size={11} color="#fff">{today.length}</Txt>
                <Txt size={11} color={C.dim}> kişi profilini gezdi</Txt>
              </View>
            </View>
          </View>

          {visitors.length === 0 && (
            <Txt size={12.5} color={C.dim} align="center" style={{ paddingVertical: 50 }}>Henüz ziyaretçin yok.</Txt>
          )}
          {today.length > 0 && (
            <>
              <Txt weight="bold" size={11.5} color={C.dim2} style={styles.sectionLbl}>BUGÜN</Txt>
              <VisitorGroup list={today} keyOffset={0} onPress={openProfile} />
            </>
          )}
          {earlier.length > 0 && (
            <>
              <Txt weight="bold" size={11.5} color={C.dim2} style={[styles.sectionLbl, { marginTop: 18 }]}>DAHA ÖNCE</Txt>
              <VisitorGroup list={earlier} keyOffset={100} onPress={openProfile} />
            </>
          )}
          {visitors.length > 0 && <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Son ziyaretçilerin gösteriliyor</Txt>}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  summary: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, marginBottom: 18, backgroundColor: "rgba(168,85,247,.16)", borderWidth: 1, borderColor: "rgba(168,85,247,.25)" },
  summaryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sectionLbl: { letterSpacing: 0.5, marginBottom: 8 },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 72 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
});
