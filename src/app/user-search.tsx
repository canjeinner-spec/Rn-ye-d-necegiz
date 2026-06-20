import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { ROOMS } from "@/data/seed";
import { SEARCH_DIR } from "@/data/search";
import { DM_THREADS } from "@/data/dm";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { ProfileCard, type ProfileCardUser } from "@/sheets/ProfileCard";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

export default function UserSearchScreen() {
  const router = useRouter();
  const { enterRoom, setActiveDM } = useApp();
  const [q, setQ] = useState("");
  const [card, setCard] = useState<ProfileCardUser | null>(null);

  const id = q.trim();
  const result = id.length >= 3 ? SEARCH_DIR[id] : undefined;
  const notFound = id.length >= 3 && !result;

  const go = () => {
    if (!result) return;
    haptic.light();
    if (result.kind === "room") {
      const r = ROOMS.find((x) => x.id === result.roomId);
      if (r) { enterRoom(r); router.replace("/room"); }
    } else {
      setCard({ name: result.name, lv: result.lv, muted: false, viewerRole: "user" });
    }
  };

  const openDM = (u: ProfileCardUser) => {
    const thread = DM_THREADS.find((d) => d.name === u.name);
    setCard(null);
    if (thread) { setActiveDM(thread); router.navigate("/dm-chat"); }
  };

  const room = result?.kind === "room" ? ROOMS.find((x) => x.id === result.roomId) : undefined;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Kullanıcı / Oda Ara</Txt>
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <View style={[styles.searchBox, { borderColor: result ? `${C.green}55` : notFound ? `${C.red}55` : "rgba(255,255,255,.12)" }]}>
            <Icon name="search" size={17} color={C.dim} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={(t) => setQ(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="ID gir (örn: 8821 veya oda 100000)"
              placeholderTextColor={C.dim2}
              style={styles.searchInput}
            />
            {!!q && (
              <Pressable onPress={() => setQ("")}>
                <Icon name="x" size={15} color={C.dim} />
              </Pressable>
            )}
          </View>
          <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 8, paddingLeft: 4 }}>Kişi ID'si profile, oda ID'si odaya götürür.</Txt>

          {result && (
            <Pressable onPress={go} style={styles.resultCard}>
              {result.kind === "room" ? (
                <>
                  <View style={styles.sceneThumb}>
                    <Scene kind={(room?.scene as never) || "club"} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>{room?.name}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <View style={styles.greenDot} />
                      <Txt weight="semibold" size={10.5} color={C.dim}>Oda · ID: {id}</Txt>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Txt weight="extrabold" size={11} color={C.purple2}>Odaya Gir</Txt>
                    <Icon name="chev" size={13} color={C.purple2} />
                  </View>
                </>
              ) : (
                <>
                  <Portrait name={result.name} size={50} ring={C.purple2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={13.5} color={C.text}>{result.name}</Txt>
                    <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>Kullanıcı · ID: {id} · LV.{result.lv}</Txt>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Txt weight="extrabold" size={11} color={C.purple2}>Profili Gör</Txt>
                    <Icon name="chev" size={13} color={C.purple2} />
                  </View>
                </>
              )}
            </Pressable>
          )}

          {notFound && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <View style={styles.notFoundIcon}>
                <Icon name="x" size={26} color="#FB7185" sw={2.5} />
              </View>
              <Txt weight="extrabold" size={13.5} color={C.text}>Bulunamadı</Txt>
              <Txt size={11.5} color={C.dim} align="center" style={{ marginTop: 6 }}>"{id}" ID'sine sahip kullanıcı veya oda yok.</Txt>
            </View>
          )}
        </View>
      </SafeAreaView>

      {card && (
        <ProfileCard
          user={card}
          onClose={() => setCard(null)}
          onDM={openDM}
          onViewProfile={() => { const u = card; setCard(null); router.navigate(`/user-profile?name=${encodeURIComponent(u.name)}&lv=${u.lv}`); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "600", padding: 0 },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: "rgba(124,58,237,.1)", borderWidth: 1, borderColor: `${C.green}44` },
  sceneThumb: { width: 50, height: 50, borderRadius: 14, overflow: "hidden" },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  notFoundIcon: { width: 56, height: 56, borderRadius: 28, marginBottom: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
});
