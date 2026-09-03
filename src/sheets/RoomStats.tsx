import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const ROOM_PERKS: { lv: number; t: string; ic: IconName }[] = [
  { lv: 5, t: "Özel oda rozeti", ic: "flag" },
  { lv: 10, t: "9. & 10. koltuk açılır", ic: "mic" },
  { lv: 20, t: "Özel giriş efekti", ic: "evStar" },
  { lv: 30, t: "Oda teması & çerçeve", ic: "crown" },
  { lv: 40, t: "Altın oda etiketi", ic: "idcard" },
];

const WEEK = [
  { d: "Pzt", v: 48 }, { d: "Sal", v: 62 }, { d: "Çar", v: 39 }, { d: "Per", v: 74 },
  { d: "Cum", v: 91 }, { d: "Cmt", v: 120 }, { d: "Paz", v: 86 },
];

const STATS: { ic: IconName; t: string; v: string; c: string }[] = [
  { ic: "mic", t: "Aktif Süre", v: "126 sa", c: "#5EEAD4" },
  { ic: "eye", t: "Ziyaretçi", v: "3.4K", c: "#A855F7" },
  { ic: "users", t: "Tepe Anlık", v: "82", c: "#60A5FA" },
];

const LV = 29, XP = 13490, NEXT = 15000;

export function RoomStats({ room, roomName, roomPhoto, onClose }: { room: Room; roomName: string; roomPhoto: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pct = Math.round((XP / NEXT) * 100);
  const maxV = Math.max(...WEEK.map((x) => x.v));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <Pressable style={{ flex: 1 }}>
            {/* Blur kaldirildi — ayni sebep (GiftSheet): altindaki gradyanin
                iki rengi de opak (#0A2230, #0A0810), blur hic gorunmuyordu. */}
            <Gradient colors={["#0A2230", "#0A0810"]} deg={160} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.handle} />
            <View style={styles.header}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <Icon name="x" size={18} color={C.text} />
              </Pressable>
              <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1, textAlign: "center", marginLeft: -34 }}>Oda Seviyesi</Txt>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 + insets.bottom, paddingTop: 8 }}>
              <View style={styles.levelCard}>
                <View style={styles.levelThumb}>
                  {roomPhoto ? <Image source={{ uri: roomPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Scene kind={room.scene} />}
                </View>
                <Txt weight="displayBold" size={17} color="#fff" numberOfLines={1}>{roomName}</Txt>
                <Gradient colors={["#5EEAD4", "#06B6D4"]} deg={135} style={styles.lvPill}>
                  <Txt weight="displayBold" size={15} color="#04231A">LV.{LV}</Txt>
                </Gradient>
                <View style={{ alignSelf: "stretch", marginTop: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Txt weight="bold" size={11} color="rgba(255,255,255,.8)">İlerleme</Txt>
                    <Txt weight="bold" size={11} color="rgba(255,255,255,.8)">{XP.toLocaleString("tr-TR")} / {NEXT.toLocaleString("tr-TR")}</Txt>
                  </View>
                  <View style={styles.progressTrack}>
                    <Gradient colors={["#5EEAD4", "#06B6D4"]} deg={90} style={{ height: "100%", width: `${pct}%`, borderRadius: 9 }} />
                  </View>
                  <Txt weight="bold" size={11} color="#5EEAD4" style={{ marginTop: 8 }}>LV.{LV + 1} için {(NEXT - XP).toLocaleString("tr-TR")} puan kaldı</Txt>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {STATS.map((s) => (
                  <View key={s.t} style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: s.c + "1F", borderColor: s.c + "44" }]}>
                      <Icon name={s.ic} size={17} color={s.c} />
                    </View>
                    <Txt weight="displayBold" size={16} color="#fff">{s.v}</Txt>
                    <Txt weight="semibold" size={9.5} color={C.dim} style={{ marginTop: 2 }}>{s.t}</Txt>
                  </View>
                ))}
              </View>

              <View style={styles.chartCard}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Txt weight="extrabold" size={13} color={C.text}>Haftalık Aktiflik</Txt>
                  <Txt weight="semibold" size={10.5} color={C.dim}>saat / gün</Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 7, height: 90 }}>
                  {WEEK.map((w, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <View style={{ width: "100%", height: (w.v / maxV) * 70, borderRadius: 6, overflow: "hidden" }}>
                        {w.v === maxV ? (
                          <Gradient colors={["#5EEAD4", "#06B6D4"]} deg={180} style={StyleSheet.absoluteFill} />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(94,234,212,.22)" }]} />
                        )}
                      </View>
                      <Txt weight="semibold" size={9} color={C.dim2}>{w.d}</Txt>
                    </View>
                  ))}
                </View>
              </View>

              <Txt weight="extrabold" size={13} color={C.text} style={{ marginTop: 20, marginBottom: 10 }}>Seviye Avantajları</Txt>
              {ROOM_PERKS.map((p) => {
                const unlocked = LV >= p.lv;
                return (
                  <View key={p.lv} style={[styles.perkRow, { opacity: unlocked ? 1 : 0.5 }]}>
                    {unlocked ? (
                      <Gradient colors={["#5EEAD4", "#06B6D4"]} deg={135} style={styles.perkIcon}>
                        <Icon name={p.ic} size={19} color="#04231A" />
                      </Gradient>
                    ) : (
                      <View style={[styles.perkIcon, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                        <Icon name={p.ic} size={19} color={C.dim} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={13} color={C.text}>{p.t}</Txt>
                      <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>LV.{p.lv} gerekli</Txt>
                    </View>
                    {unlocked ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="check" size={13} sw={3} color="#5EEAD4" />
                        <Txt weight="extrabold" size={10.5} color="#5EEAD4">Açık</Txt>
                      </View>
                    ) : (
                      <Icon name="lock" size={15} color={C.dim2} />
                    )}
                  </View>
                );
              })}
              <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Oda aktif oldukça ve hediye aldıkça seviye yükselir</Txt>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.55)" },
  sheet: { height: "86%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)", backgroundColor: "#0A0810" },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.2)", alignSelf: "center", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  levelCard: { borderRadius: 20, padding: 20, alignItems: "center", backgroundColor: "rgba(94,234,212,.1)", borderWidth: 1, borderColor: "rgba(94,234,212,.25)" },
  levelThumb: { width: 72, height: 72, borderRadius: 20, overflow: "hidden", marginBottom: 12 },
  lvPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  progressTrack: { height: 9, borderRadius: 9, backgroundColor: "rgba(255,255,255,.1)", overflow: "hidden" },
  statCard: { flex: 1, borderRadius: 15, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", backgroundColor: "#15131C", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 8, borderWidth: 1 },
  chartCard: { marginTop: 18, borderRadius: 16, padding: 16, backgroundColor: "#15131C", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  perkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
