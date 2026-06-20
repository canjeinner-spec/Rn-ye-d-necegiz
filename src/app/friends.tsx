import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
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
      <Gradient colors={["#0A2A1E", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
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

        <View style={styles.tabs}>
          {["Arkadaşlar", "İstekler"].map((t, i) => {
            const on = i === tab;
            return (
              <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={styles.tab}>
                <Txt weight={on ? "extrabold" : "medium"} size={14} color={on ? "#fff" : "rgba(255,255,255,.42)"}>{t}</Txt>
                {i === 1 && reqs.length > 0 && (
                  <View style={styles.reqBadge}>
                    <Txt weight="extrabold" size={10} color="#fff">{reqs.length}</Txt>
                  </View>
                )}
                {on && <Gradient colors={["#34D399", "#059669"]} deg={90} style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <View style={styles.search}>
                <Icon name="search" size={15} color={C.dim2} />
                <TextInput value={q} onChangeText={setQ} placeholder="Arkadaş ara" placeholderTextColor={C.dim2} style={styles.searchInput} />
              </View>
              <View style={{ flexDirection: "row", marginBottom: 6 }}>
                <Txt weight="bold" size={11.5} color={C.dim}>{friends.length} arkadaş · </Txt>
                <Txt weight="bold" size={11.5} color="#34D399">{onlineCount} çevrimiçi</Txt>
              </View>
              {filtered.map((f, i) => (
                <View key={f.name + i} style={styles.row}>
                  <Portrait name={f.name} size={46} online={f.online} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Txt weight="extrabold" size={13.5} color={C.text}>{f.name}</Txt>
                      <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{f.lv}</Txt>
                    </View>
                    <Txt weight="semibold" size={10.5} color={f.online ? "#34D399" : C.dim2} style={{ marginTop: 3 }}>{f.last}</Txt>
                  </View>
                  <Pressable onPress={() => openChat(f)} style={styles.chatBtn}>
                    <Icon name="chat" size={17} color="#34D399" />
                  </Pressable>
                </View>
              ))}
              {filtered.length === 0 && (
                <Txt weight="semibold" size={12.5} color={C.dim} align="center" style={{ paddingVertical: 50 }}>{q ? "Arkadaş bulunamadı." : "Henüz arkadaşın yok."}</Txt>
              )}
            </>
          ) : reqs.length > 0 ? (
            reqs.map((r, i) => (
              <View key={r.name + i} style={styles.reqRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Portrait name={r.name} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Txt weight="extrabold" size={13.5} color={C.text}>{r.name}</Txt>
                      <Txt weight="extrabold" size={10.5} color="#5EEAD4">LV.{r.lv}</Txt>
                    </View>
                    <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 3 }}>{r.when}</Txt>
                  </View>
                </View>
                {r.note && <Txt size={12} color={C.dim} lh={1.5} style={styles.reqNote}>"{r.note}"</Txt>}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 11, marginLeft: 60 }}>
                  <Pressable onPress={() => accept(i)} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
                    <Gradient colors={["#34D399", "#059669"]} deg={135} style={styles.reqBtn}>
                      <Icon name="check" size={15} color="#04231A" sw={3} />
                      <Txt weight="extrabold" size={12.5} color="#04231A">Kabul Et</Txt>
                    </Gradient>
                  </Pressable>
                  <Pressable onPress={() => reject(i)} style={[styles.reqBtn, { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" }]}>
                    <Icon name="x" size={15} color={C.dim} />
                    <Txt weight="extrabold" size={12.5} color={C.dim}>Reddet</Txt>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <View style={styles.emptyIcon}>
                <Icon name="userAdd" size={26} color={C.dim2} />
              </View>
              <Txt size={13} color={C.dim}>Yeni arkadaşlık isteğin yok.</Txt>
            </View>
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
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginTop: 6, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13 },
  tabUnderline: { position: "absolute", bottom: -1, width: 30, height: 3, borderRadius: 3 },
  reqBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999, backgroundColor: "#F43F5E", alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", marginBottom: 14 },
  searchInput: { flex: 1, color: C.text, fontSize: 12.5, padding: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  chatBtn: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(52,211,153,.12)", borderWidth: 1, borderColor: "rgba(52,211,153,.3)" },
  reqRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  reqNote: { marginTop: 9, marginLeft: 60, fontStyle: "italic" },
  reqBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, marginBottom: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: "rgba(52,211,153,.5)", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
});
