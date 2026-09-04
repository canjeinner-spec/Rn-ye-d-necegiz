import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Scene } from "@/components/Scene";
import { Txt } from "@/components/Txt";
import { ROOMS } from "@/data/seed";
import { SEARCH_DIR } from "@/data/search";
import { searchProfiles, type PublicProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

export default function UserSearchScreen() {
  const router = useRouter();
  const odayaGirDene = useApp((s) => s.odayaGirDene);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const reqId = useRef(0);

  const id = q.trim();
  // Oda araması: sayısal ID ile mock dizinden (Faz 2'nin sonraki diliminde DB'ye taşınacak).
  const roomHit = /^\d{4,6}$/.test(id) && SEARCH_DIR[id]?.kind === "room" ? SEARCH_DIR[id] : undefined;
  const room = roomHit ? ROOMS.find((x) => x.id === roomHit.roomId) : undefined;

  // Kullanıcı araması (debounce + son istek kazanır).
  useEffect(() => {
    if (!isSupabaseConfigured || id.length < 2) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    const mine = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const r = await searchProfiles(id);
        if (mine === reqId.current) { setResults(r); setSearched(true); }
      } catch {
        if (mine === reqId.current) { setResults([]); setSearched(true); }
      } finally {
        if (mine === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [id]);

  const openRoom = () => {
    if (!room) return;
    haptic.light();
    odayaGirDene(room);
  };

  const openProfile = (u: PublicProfile) => {
    router.navigate(`/user-profile?publicId=${encodeURIComponent(u.public_id)}&name=${encodeURIComponent(u.kullanici_adi)}`);
  };

  const noResults = searched && !loading && results.length === 0 && !room;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Icon name="back" size={16} color={C.text} />
            </Pressable>
            <Txt weight="displayBold" size={16} color="#fff">Kullanıcı / Oda Ara</Txt>
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 14, flex: 1 }}>
            <View style={[styles.searchBox, { borderColor: results.length || room ? `${C.green}55` : noResults ? `${C.red}55` : "rgba(255,255,255,.12)" }]}>
              <Icon name="search" size={17} color={C.dim} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                placeholder="Kullanıcı adı veya ID ara"
                placeholderTextColor={C.dim2}
                style={styles.searchInput}
              />
              {loading ? <ActivityIndicator size="small" color={C.dim} /> : !!q && (
                <Pressable onPress={() => setQ("")}>
                  <Icon name="x" size={15} color={C.dim} />
                </Pressable>
              )}
            </View>
            <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 8, paddingLeft: 4 }}>İsimle kişi, sayısal ID ile oda ara.</Txt>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
              {room && (
                <Pressable onPress={openRoom} style={styles.resultCard}>
                  <View style={styles.sceneThumb}>
                    <Scene kind={(room.scene as never) || "club"} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>{room.name}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <View style={styles.greenDot} />
                      <Txt weight="semibold" size={10.5} color={C.dim}>Oda · ID: {id}</Txt>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Txt weight="extrabold" size={11} color={C.purple2}>Odaya Gir</Txt>
                    <Icon name="chev" size={13} color={C.purple2} />
                  </View>
                </Pressable>
              )}

              {results.length > 0 && (
                <View style={styles.group}>
                  {results.map((u, i) => (
                    <View key={u.public_id}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable onPress={() => openProfile(u)} style={styles.userRow}>
                        <Portrait name={u.kullanici_adi} size={48} ring={C.purple2} photo={u.profil_resmi || undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1}>{u.kullanici_adi}</Txt>
                          <Txt weight="semibold" size={10.5} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>
                            ID: {u.ozel_id || u.public_id}{u.seviye_id ? ` · LV.${u.seviye_id}` : ""}
                          </Txt>
                        </View>
                        <Icon name="chev" size={15} color={C.dim2} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {noResults && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <View style={styles.notFoundIcon}>
                    <Icon name="x" size={26} color="#FB7185" sw={2.5} />
                  </View>
                  <Txt weight="extrabold" size={13.5} color={C.text}>Bulunamadı</Txt>
                  <Txt size={11.5} color={C.dim} align="center" style={{ marginTop: 6 }}>"{id}" ile eşleşen kullanıcı veya oda yok.</Txt>
                </View>
              )}

              {!isSupabaseConfigured && (
                <Txt size={11} color={C.dim2} align="center" style={{ marginTop: 30 }}>Arama için bağlantı yapılandırılmamış.</Txt>
              )}
            </ScrollView>
          </View>
        </KeyboardAware>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, backgroundColor: C.kontrol, borderWidth: 1 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "600", padding: 0 },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: "rgba(124,58,237,.1)", borderWidth: 1, borderColor: `${C.green}44` },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 74 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  sceneThumb: { width: 50, height: 50, borderRadius: 14, overflow: "hidden" },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  notFoundIcon: { width: 56, height: 56, borderRadius: 28, marginBottom: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.12)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
});
