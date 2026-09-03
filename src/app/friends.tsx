import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Tabs } from "@/components/Tabs";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import { FRIEND_LIST, FRIEND_REQS, type Friend, type FriendReq } from "@/data/friends";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { DM_THREADS } from "@/data/dm";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setActiveDM = useApp((s) => s.setActiveDM);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<Friend[]>(FRIEND_LIST);
  const [reqs, setReqs] = useState<FriendReq[]>(FRIEND_REQS);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const filtered = friends.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const onlineCount = friends.filter((f) => f.online).length;

  const note = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 1800);
  };
  const accept = (i: number) => {
    const r = reqs[i];
    haptic.success();
    setReqs((rs) => rs.filter((_, j) => j !== i));
    setFriends((fs) => [{ name: r.name, lv: r.lv, online: true, last: "Çevrimiçi" }, ...fs]);
    note(`${r.name} arkadaş olarak eklendi.`);
  };
  const reject = (i: number) => {
    const r = reqs[i];
    haptic.light();
    setReqs((rs) => rs.filter((_, j) => j !== i));
    note(`${r.name} reddedildi.`);
  };
  const openChat = (f: Friend) => {
    haptic.light();
    const thread = DM_THREADS.find((d) => d.name === f.name);
    if (thread) { setActiveDM(thread); router.navigate("/dm-chat"); }
  };

  return (
    <View style={styles.root}>
      {/* Zemin yeşildi (#0A2A1E) — uygulamanın siyah-altınına çekildi. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Arkadaşlar</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* Kendi kopya sekme çubuğu vardı; uygulamanın ortak Tabs'ı */}
        <Tabs
          items={["Arkadaşlar", reqs.length > 0 ? `İstekler (${reqs.length})` : "İstekler"]}
          active={tab}
          set={setTab}
          fill
          pad={16}
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <View style={styles.search}>
                <Icon name="search" size={15} color={C.dim2} />
                <TextInput value={q} onChangeText={setQ} placeholder="Arkadaş ara" placeholderTextColor={C.dim2} style={styles.searchInput} />
                {!!q && (
                  <Pressable onPress={() => setQ("")} hitSlop={8}>
                    <Icon name="x" size={14} color={C.dim} />
                  </Pressable>
                )}
              </View>

              {/* Sayılar düz bir gri satırdı; ayırıcılı cam şerit oldu. */}
              <View style={styles.ozet}>
                <View style={styles.ozetKol}>
                  <Txt weight="displayBold" size={16} color="#fff">{friends.length}</Txt>
                  <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 2, letterSpacing: 0.3 }}>ARKADAŞ</Txt>
                </View>
                <View style={styles.ozetAyirici} />
                <View style={styles.ozetKol}>
                  <Txt weight="displayBold" size={16} color="#6EE7B7">{onlineCount}</Txt>
                  <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 2, letterSpacing: 0.3 }}>ÇEVRİMİÇİ</Txt>
                </View>
              </View>

              {filtered.length > 0 ? (
                <View style={styles.group}>
                  {filtered.map((f, i) => (
                    <View key={f.name + i}>
                      {i > 0 && <View style={styles.divider} />}
                      {/* Satırın tamamı basılabilir: sohbet küçük bir ikondu,
                          satıra dokununca hiçbir şey olmuyordu. */}
                      <Pressable onPress={() => openChat(f)} style={styles.row}>
                        <Portrait name={f.name} size={46} online={f.online} ring={f.online ? C.green : undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{f.name}</Txt>
                            <View style={styles.lvHap}>
                              <Txt weight="extrabold" size={9.5} color="#5EEAD4">LV.{f.lv}</Txt>
                            </View>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <View style={[styles.durumNokta, { backgroundColor: f.online ? "#6EE7B7" : C.dim2 }]} />
                            <Txt weight="semibold" size={10.5} color={f.online ? "#6EE7B7" : C.dim2}>{f.last}</Txt>
                          </View>
                        </View>
                        <View style={styles.chatBtn}>
                          <Icon name="chat" size={16} color={C.gold2} />
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <BosDurum
                  anim={BOS_KUTU}
                  baslik={q ? "Arkadaş bulunamadı" : "Henüz arkadaşın yok"}
                  alt={q ? `"${q}" ile eşleşen bir arkadaşın yok.` : "Odalarda tanıştığın kişilere arkadaşlık isteği gönderebilirsin."}
                />
              )}
            </>
          ) : reqs.length > 0 ? (
            /* İstekler ayrı kartlar. Önceden tek grup içinde ayırıcılıydı ve
               butonlar marginLeft:60 ile içeriden başlıyordu — sağa kaçmış,
               hizasız duruyorlardı. */
            <View style={{ gap: 12 }}>
              {reqs.map((r, i) => (
                <View key={r.name + i} style={styles.reqKart}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Portrait name={r.name} size={48} ring={C.gold + "66"} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={14} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</Txt>
                        <View style={styles.lvHap}>
                          <Txt weight="extrabold" size={9.5} color="#5EEAD4">LV.{r.lv}</Txt>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <Icon name="cal" size={10} color={C.dim2} />
                        <Txt weight="semibold" size={10.5} color={C.dim2}>{r.when}</Txt>
                      </View>
                    </View>
                  </View>

                  {r.note && (
                    <View style={styles.notKutu}>
                      <Txt size={12} color={C.text} lh={1.5} style={{ fontStyle: "italic" }}>{r.note}</Txt>
                    </View>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 13 }}>
                    <Pressable onPress={() => reject(i)} style={[styles.reqBtn, { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1.5, borderColor: "rgba(255,255,255,.14)" }]}>
                      <Icon name="x" size={15} color={C.dim} />
                      <Txt weight="extrabold" size={12.5} color={C.dim}>Reddet</Txt>
                    </Pressable>
                    <Pressable onPress={() => accept(i)} style={{ flex: 1.3, borderRadius: 13, overflow: "hidden" }}>
                      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.reqBtn}>
                        <Icon name="check" size={15} color="#241A05" sw={3} />
                        <Txt weight="extrabold" size={12.5} color="#241A05">Kabul Et</Txt>
                      </Gradient>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <BosDurum
              anim={BOS_KUTU}
              baslik="Bekleyen istek yok"
              alt="Sana arkadaşlık isteği gelirse burada görünür."
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {!!toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 30 + insets.bottom }]}>
          <Txt weight="bold" size={12} color="#fff">{toast}</Txt>
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
  search: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 12.5, padding: 0 },
  group: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 70 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  chatBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "16", borderWidth: 1, borderColor: C.gold + "44" },
  ozet: { flexDirection: "row", alignItems: "center", marginBottom: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  ozetKol: { flex: 1, alignItems: "center", paddingVertical: 11 },
  ozetAyirici: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: "rgba(255,255,255,.12)" },
  lvHap: { paddingVertical: 1.5, paddingHorizontal: 7, borderRadius: 999, backgroundColor: "rgba(94,234,212,.12)", borderWidth: 1, borderColor: "rgba(94,234,212,.30)" },
  durumNokta: { width: 6, height: 6, borderRadius: 3 },
  reqKart: { padding: 14, borderRadius: 18, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: C.gold + "2E" },
  notKutu: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  reqBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 13 },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: C.gold + "66", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
});
