import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { EV_TAGS, EVENTS, type EventItem } from "@/data/events";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [openEv, setOpenEv] = useState<EventItem | null>(null);
  const [joined, setJoined] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const filtered = EVENTS.filter((e) => (tab === 0 ? true : tab === 1 ? e.tag === "yayinda" : e.tag === "yakinda"));
  const featured = EVENTS.find((e) => e.featured);

  const flash = (t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2200);
  };
  const act = (e: EventItem) => {
    if (e.tag === "bitti") return;
    haptic.success();
    if (e.tag === "yakinda") flash("Hatırlatıcı kuruldu, başlayınca haber vereceğiz.");
    else { setJoined((j) => (j.includes(e.id) ? j : [...j, e.id])); flash(`"${e.title}" etkinliğine katıldın!`); }
    setOpenEv(null);
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Etkinlikler</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* Kendi kopya sekme çubuğu vardı; uygulamanın ortak Tabs'ı */}
        <Tabs items={["Tümü", "Yayında", "Yakında"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 && featured && (
            <Pressable onPress={() => { haptic.light(); setOpenEv(featured); }} style={styles.featured}>
              <Gradient colors={[featured.c1, featured.c2]} deg={140} style={styles.featuredCover}>
                <View style={styles.featWatermark}>
                  <Icon name={featured.ic} size={120} color="#fff" sw={1.2} />
                </View>
                <View style={styles.featTag}>
                  <Icon name="evStar" size={11} color="#fff" />
                  <Txt weight="extrabold" size={9.5} color="#fff">ÖNE ÇIKAN</Txt>
                </View>
                <View style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
                  <Txt weight="displayBold" size={22} color="#fff">{featured.title}</Txt>
                  <Txt weight="bold" size={11} color="rgba(255,255,255,.9)" style={{ marginTop: 4 }}>{featured.date}</Txt>
                </View>
              </Gradient>
            </Pressable>
          )}

          <View style={{ gap: 12 }}>
            {filtered.map((e) => {
              const tg = EV_TAGS[e.tag];
              const isJoined = joined.includes(e.id);
              return (
                <Pressable key={e.id} onPress={() => { haptic.light(); setOpenEv(e); }} style={[styles.card, { borderColor: `${e.c1}26`, opacity: e.tag === "bitti" ? 0.62 : 1 }]}>
                  <Gradient colors={[e.c1, e.c2]} deg={150} style={styles.cardIcon}>
                    <Icon name={e.ic} size={28} color="#fff" sw={1.8} />
                  </Gradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <Txt weight="extrabold" size={13.5} color={C.text}>{e.title}</Txt>
                      <View style={[styles.evTag, { backgroundColor: `${tg.c}1F`, borderColor: `${tg.c}44` }]}>
                        <Txt weight="extrabold" size={9} color={tg.c}>{tg.t}</Txt>
                      </View>
                      {isJoined && (
                        <View style={[styles.evTag, { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#34D3991F", borderColor: "#34D39944" }]}>
                          <Icon name="check" size={9} sw={3.5} color="#34D399" />
                          <Txt weight="extrabold" size={9} color="#34D399">Katıldın</Txt>
                        </View>
                      )}
                    </View>
                    <Txt size={11} color={C.dim} lh={1.45} numberOfLines={2} style={{ marginTop: 4 }}>{e.desc}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                      <Icon name="cal" size={11} color={C.dim2} />
                      <Txt weight="semibold" size={10} color={C.dim2}>{e.date}</Txt>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!openEv} transparent animationType="none" statusBarTranslucent onRequestClose={() => setOpenEv(null)}>
        <Pressable style={styles.detailBackdrop} onPress={() => setOpenEv(null)}>
          {openEv && (
            <Animated.View entering={SlideInDown.duration(300)} exiting={SlideOutDown.duration(200)}>
              <Pressable>
                <View style={styles.detailSheet}>
                  <Gradient colors={[openEv.c1, openEv.c2]} deg={140} style={styles.detailCover}>
                    <View style={{ position: "absolute", top: 14, right: 16, opacity: 0.28 }}>
                      <Icon name={openEv.ic} size={130} color="#fff" sw={1.1} />
                    </View>
                    <Pressable onPress={() => setOpenEv(null)} style={styles.detailClose}>
                      <Icon name="x" size={16} color="#fff" />
                    </Pressable>
                    <View style={styles.detailTag}>
                      <Txt weight="extrabold" size={10} color="#fff">{EV_TAGS[openEv.tag].t}</Txt>
                    </View>
                  </Gradient>
                  <View style={{ padding: 20, paddingBottom: 22 + insets.bottom }}>
                    <Txt weight="displayBold" size={20} color="#fff">{openEv.title}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Icon name="cal" size={13} color={openEv.c1} />
                      <Txt weight="bold" size={11.5} color={openEv.c1}>{openEv.date}</Txt>
                    </View>
                    <Txt size={13} color={C.dim} lh={1.6} style={{ marginTop: 14 }}>{openEv.desc}</Txt>
                    <View style={styles.detailInfo}>
                      <Txt size={12.5} color={C.dim} lh={1.6}>
                        Etkinliğe katılmak için odalarda aktif ol, hediye gönder ve görevleri tamamla. Ödüller etkinlik bitiminde otomatik hesabına tanımlanır.
                      </Txt>
                    </View>
                    <Pressable onPress={() => act(openEv)} disabled={openEv.tag === "bitti"} style={{ marginTop: 18, borderRadius: 16, overflow: "hidden", opacity: openEv.tag === "bitti" ? 0.45 : 1 }}>
                      <Gradient colors={[openEv.c1, openEv.c2]} deg={135} style={styles.detailCta}>
                        {joined.includes(openEv.id) && <Icon name="check" size={15} sw={3} color="#fff" />}
                        <Txt weight="extrabold" size={14} color="#fff">
                          {joined.includes(openEv.id) ? "Katıldın" : openEv.tag === "bitti" ? "Etkinlik Sona Erdi" : openEv.tag === "yakinda" ? "Hatırlatıcı Kur" : "Etkinliğe Katıl"}
                        </Txt>
                      </Gradient>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>

      {!!toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 30 + insets.bottom }]}>
          <Txt weight="bold" size={12} color="#fff" align="center">{toast}</Txt>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginTop: 6, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)" },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabUnderline: { position: "absolute", bottom: -1, width: 28, height: 3, borderRadius: 3 },
  featured: { borderRadius: 20, overflow: "hidden", marginBottom: 18 },
  featuredCover: { height: 152, justifyContent: "flex-end" },
  featWatermark: { position: "absolute", top: 8, right: 10, opacity: 0.22 },
  featTag: { position: "absolute", top: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,.32)", borderWidth: 1, borderColor: "rgba(255,255,255,.35)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 },
  card: { flexDirection: "row", gap: 13, padding: 13, borderRadius: 18, backgroundColor: "#15131C", borderWidth: 1 },
  cardIcon: { width: 58, height: 58, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  evTag: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, borderWidth: 1 },
  detailBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.6)" },
  detailSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", backgroundColor: "#12111A", borderTopWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  detailCover: { height: 160 },
  detailClose: { position: "absolute", top: 14, left: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.35)", borderWidth: 1, borderColor: "rgba(255,255,255,.25)", alignItems: "center", justifyContent: "center" },
  detailTag: { position: "absolute", bottom: 14, left: 16, backgroundColor: "rgba(0,0,0,.4)", borderWidth: 1, borderColor: "rgba(255,255,255,.4)", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  detailInfo: { marginTop: 12, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", borderRadius: 14, padding: 14 },
  detailCta: { flexDirection: "row", gap: 7, paddingVertical: 15, alignItems: "center" },
  toast: { position: "absolute", alignSelf: "center", maxWidth: "86%", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: `${C.gold}55`, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
});
