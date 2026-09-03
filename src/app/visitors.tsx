import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/Badge";
import { Portrait } from "@/components/Portrait";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import { VISITORS, type Visitor } from "@/data/visitors";
import { getMyVisitors } from "@/data/remote/visitRepo";
import { getCached, setCached } from "@/lib/cache";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

function VisitorRow({ v, onPress }: { v: Visitor; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      {/* `online={i % 3 !== 0}` vardı: çevrimiçi noktası ziyaretçinin
          SIRASINDAN uyduruluyordu, her üçüncüsü çevrimdışı görünüyordu.
          Visitor verisinde böyle bir alan yok — kaldırıldı. */}
      <Portrait name={v.name} size={48} ring={v.vip ? C.gold : undefined} glow={v.vip} photo={v.photo} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Txt weight="extrabold" size={13.5} color={v.vip ? C.gold2 : C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{v.name}</Txt>
          <View style={styles.lvHap}>
            <Txt weight="extrabold" size={9.5} color="#5EEAD4">LV.{v.lv}</Txt>
          </View>
          {v.vip && <Badge type="vip" size={15} />}
          {!!v.gender && <Icon name="male" size={12} color={v.gender === "k" ? "#F472B6" : "#60A5FA"} />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
          <Icon name="eye" size={10} color={C.dim2} />
          <Txt weight="semibold" size={10.5} color={C.dim2}>{v.when} ziyaret etti</Txt>
        </View>
      </View>
      <Icon name="chev" size={15} color={C.dim2} />
    </Pressable>
  );
}

function VisitorGroup({ list, onPress }: { list: Visitor[]; onPress: (v: Visitor) => void }) {
  return (
    <View style={styles.group}>
      {list.map((v, i) => (
        <View key={(v.publicId || v.name) + i}>
          {i > 0 && <View style={styles.divider} />}
          <VisitorRow v={v} onPress={() => onPress(v)} />
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
      {/* Zemin mordu (#1E0E2E) — uygulamanın siyah-altınına çekildi. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
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
          {/* Özet kartı mor dolguydu; siyah cam + altın kenar oldu. */}
          <View style={styles.summary}>
            <Gradient colors={[C.gold + "16", "transparent"]} deg={140} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.summaryIcon}>
              <Icon name="eye" size={22} color={C.gold2} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
                <Txt weight="displayBold" size={24} color="#fff">{visitors.length}</Txt>
                <Txt weight="bold" size={11.5} color={C.gold2}>toplam ziyaretçi</Txt>
              </View>
              <Txt size={11} color={C.dim} style={{ marginTop: 3 }}>
                Bugün <Txt weight="bold" size={11} color="#fff">{today.length}</Txt> kişi profilini gezdi
              </Txt>
            </View>
          </View>

          {visitors.length === 0 ? (
            <BosDurum
              anim={BOS_KUTU}
              baslik="Henüz ziyaretçin yok"
              alt="Profilini ziyaret edenler burada listelenir."
            />
          ) : (
            <>
              {today.length > 0 && (
                <>
                  <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>BUGÜN</Txt>
                  <VisitorGroup list={today} onPress={openProfile} />
                </>
              )}
              {earlier.length > 0 && (
                <>
                  <Txt weight="bold" size={10.5} color={C.dim} style={[styles.sectionLbl, { marginTop: 20 }]}>DAHA ÖNCE</Txt>
                  <VisitorGroup list={earlier} onPress={openProfile} />
                </>
              )}
              <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 18 }}>Son ziyaretçilerin gösteriliyor</Txt>
            </>
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
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  summary: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, marginBottom: 18, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: C.gold + "3D", overflow: "hidden" },
  summaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "44" },
  sectionLbl: { letterSpacing: 0.5, marginBottom: 9 },
  lvHap: { paddingVertical: 1.5, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "rgba(94,234,212,.12)", borderWidth: 1, borderColor: "rgba(94,234,212,.30)" },
  group: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 72 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
});
