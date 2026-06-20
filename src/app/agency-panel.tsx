import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AgencyEmblem } from "@/components/AgencyEmblem";
import { Badge } from "@/components/Badge";
import { CenterModal } from "@/components/CenterModal";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { AGENCY_MEMBERS, STREAMER_WEEK, type AgencyMember } from "@/data/agency";
import { SEARCH_DIR } from "@/data/search";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const WEEK_MAX = Math.max(...STREAMER_WEEK.map((x) => x.v));

export default function AgencyPanelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [members, setMembers] = useState<AgencyMember[]>(AGENCY_MEMBERS);
  const [addOpen, setAddOpen] = useState(false);
  const [addId, setAddId] = useState("");
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const note = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 1800);
  };
  const removeMember = (name: string) => { haptic.medium(); setMembers((ms) => ms.filter((x) => x.name !== name)); note(`${name} ajanstan çıkarıldı.`); };
  const addMember = () => {
    const u = SEARCH_DIR[addId.trim()];
    if (!u || u.kind !== "user") { haptic.warning(); note("Bu ID'de kullanıcı bulunamadı."); return; }
    if (members.some((m) => m.name === u.name)) { note("Zaten ajansta."); setAddOpen(false); return; }
    haptic.success();
    setMembers((ms) => [...ms, { name: u.name, role: "streamer", coins: "0", hours: 0, active: true }]);
    setAddOpen(false); setAddId(""); note(`${u.name} ajansa eklendi.`);
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#0C2418", "#08080C"]} deg={170} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Yayıncı Paneli</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.tabs}>
          {["Yayıncı", "Ajansım"].map((t, i) => (
            <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={{ flex: 1, borderRadius: 11, overflow: "hidden" }}>
              {i === tab ? (
                <Gradient colors={["#34D399", "#059669"]} deg={135} style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color="#04231A">{t}</Txt>
                </Gradient>
              ) : (
                <View style={styles.tabInner}>
                  <Txt weight="extrabold" size={12.5} color={C.dim}>{t}</Txt>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <Gradient colors={["rgba(52,211,153,.22)", "rgba(5,150,105,.08)"]} deg={150} style={styles.earnCard}>
                <Txt weight="bold" size={11.5} color="#6EE7B7">Bu ay toplam kazanç</Txt>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 }}>
                  <Txt weight="displayBold" size={30} color="#fff">$142.50</Txt>
                  <Txt weight="bold" size={12} color="#6EE7B7">≈ 29.925 🪙</Txt>
                </View>
                <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
                  {([["4.926", "Alınan hediye"], ["318 sa", "Yayın süresi"], ["#5", "Sıralama"]] as const).map(([v, l]) => (
                    <View key={l}>
                      <Txt weight="extrabold" size={16} color="#fff">{v}</Txt>
                      <Txt size={10} color="#6EE7B7" style={{ marginTop: 2 }}>{l}</Txt>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => { haptic.light(); router.navigate("/withdraw"); }} style={{ marginTop: 16, borderRadius: 13, overflow: "hidden" }}>
                  <Gradient colors={["#34D399", "#059669"]} deg={90} style={styles.withdrawBtn}>
                    <Txt weight="extrabold" size={13} color="#04231A">Para Çek</Txt>
                  </Gradient>
                </Pressable>
              </Gradient>

              <Txt weight="extrabold" size={13} color={C.text} style={{ marginTop: 18, marginBottom: 14 }}>Haftalık Kazanç ($)</Txt>
              <View style={styles.chart}>
                {STREAMER_WEEK.map((x, i) => (
                  <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <Txt weight="bold" size={9} color={C.dim}>{x.v}</Txt>
                    <View style={{ width: "100%", maxWidth: 24, height: (x.v / WEEK_MAX) * 86, alignItems: "stretch" }}>
                      {i === 5 ? (
                        <Gradient colors={["#34D399", "#059669"]} deg={180} style={[styles.bar, { borderColor: "#34D399" }]} />
                      ) : (
                        <View style={[styles.bar, { backgroundColor: "rgba(52,211,153,.3)", borderColor: "rgba(52,211,153,.4)" }]} />
                      )}
                    </View>
                    <Txt weight="semibold" size={9} color={C.dim2}>{x.d}</Txt>
                  </View>
                ))}
              </View>

              <Txt weight="extrabold" size={13} color={C.text} style={{ marginTop: 20, marginBottom: 10 }}>Bağlı Olduğun Ajans</Txt>
              <View style={styles.linkedAgency}>
                <AgencyEmblem s={38} />
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={13.5} color={C.text}>Aron Stars</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>Sahip: Ardaowski · 48 üye</Txt>
                </View>
                <View style={styles.commission}>
                  <Txt weight="extrabold" size={10} color="#6EE7B7">Komisyon %70</Txt>
                </View>
              </View>
            </>
          ) : (
            <>
              <Gradient colors={["rgba(245,206,110,.18)", "rgba(124,58,237,.1)"]} deg={150} style={styles.agencyCard}>
                <AgencyEmblem s={50} />
                <View style={{ flex: 1 }}>
                  <Txt weight="displayBold" size={17} color="#fff">Aron Stars</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 3 }}>Ajans ID: 1 · Sıralama #1</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 }}>
                    <DiamondBadge size={14} />
                    <Txt weight="extrabold" size={13} color={C.gold2}>12.6M</Txt>
                    <Txt size={10} color={C.dim}>aylık ciro</Txt>
                  </View>
                </View>
              </Gradient>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 10 }}>
                <Txt weight="extrabold" size={13} color={C.text}>Üyeler ({members.length})</Txt>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => { haptic.light(); setAddOpen(true); }} style={{ borderRadius: 11, overflow: "hidden" }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.addBtn}>
                    <Icon name="userAdd" size={14} color="#241A05" />
                    <Txt weight="extrabold" size={11.5} color="#241A05">Üye Ekle</Txt>
                  </Gradient>
                </Pressable>
              </View>

              {members.map((m) => (
                <View key={m.name} style={styles.memberRow}>
                  <Portrait name={m.name} size={42} online={m.active} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Txt weight="extrabold" size={12.5} color={C.text}>{m.name}</Txt>
                      <Badge type="streamer" size={14} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <CoinBadge size={11} />
                        <Txt size={10} color={C.dim}>{m.coins}</Txt>
                      </View>
                      <Txt size={10} color={C.dim}>{m.hours} sa yayın</Txt>
                      <Txt size={10} color={m.active ? "#6EE7B7" : C.dim2}>{m.active ? "● Aktif" : "○ Pasif"}</Txt>
                    </View>
                  </View>
                  <Pressable onPress={() => removeMember(m.name)} style={styles.removeBtn}>
                    <Icon name="trash" size={15} color="#FB7185" />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <CenterModal visible={addOpen} onClose={() => setAddOpen(false)}>
        <View style={styles.dialog}>
          <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 6 }}>Ajansa Üye Ekle</Txt>
          <Txt size={11.5} color={C.dim} style={{ marginBottom: 14 }}>Eklemek istediğin yayıncının ID'sini gir.</Txt>
          <View style={styles.addInputBox}>
            <Icon name="search" size={16} color={C.dim} />
            <TextInput
              autoFocus
              value={addId}
              onChangeText={(t) => setAddId(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Yayıncı ID (örn: 8821)"
              placeholderTextColor={C.dim2}
              style={{ flex: 1, color: C.text, fontSize: 13, padding: 0 }}
            />
          </View>
          <Pressable onPress={addMember} style={{ marginTop: 16, borderRadius: 14, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.addConfirm}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Ekle</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      {!!toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.toast, { bottom: 24 + insets.bottom }]}>
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
  tabs: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 6, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4 },
  tabInner: { paddingVertical: 9, alignItems: "center", borderRadius: 11 },
  earnCard: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(52,211,153,.25)" },
  withdrawBtn: { paddingVertical: 13, alignItems: "center" },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, height: 120, paddingHorizontal: 4 },
  bar: { flex: 1, borderRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, borderWidth: 1 },
  linkedAgency: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  commission: { backgroundColor: `${C.green}1A`, borderWidth: 1, borderColor: `${C.green}44`, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  agencyCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(245,206,110,.22)" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 13 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 15, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginBottom: 9 },
  removeBtn: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.25)" },
  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  addInputBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  addConfirm: { paddingVertical: 14, alignItems: "center" },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(15,13,21,.95)", borderWidth: 1, borderColor: `${C.gold}55`, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
});
