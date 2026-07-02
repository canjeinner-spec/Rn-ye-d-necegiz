import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { getAdminCounts, searchUsers } from "@/data/remote/adminRepo";
import { listReports, setReportStatus, type ReportRow } from "@/data/remote/reportRepo";
import { type PublicProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function zaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ============================================================================
export default function AdminScreen() {
  const router = useRouter();
  const [mainTab, setMainTab] = useState(0); // 0: Raporlar, 1: Kullanıcı
  const [repTab, setRepTab] = useState(0); // 0: bekleyen, 1: tümü
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<{ bekleyen: number; kullanici: number } | null>(null);

  // arama
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    listReports().then(setReports).catch((e) => console.warn("[admin] raporlar:", e?.message || e));
    getAdminCounts().then(setCounts).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // arama (debounce)
  useEffect(() => {
    if (!isSupabaseConfigured || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchUsers(q.trim()).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const openUser = (userId: number) => { haptic.light(); router.navigate(`/admin-user?userId=${userId}`); };
  const openRoomReport = (r: ReportRow) => {
    haptic.light();
    router.navigate(`/admin-room-report?odaId=${r.hedefOdaId}${Number.isFinite(r.id) ? `&sikayetId=${r.id}` : ""}`);
  };

  const shown = repTab === 0 ? reports.filter((r) => r.durum === "bekliyor") : reports;
  const markReviewed = (r: ReportRow) => {
    haptic.success();
    setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, durum: "incelendi" } : x)));
    setCounts((c) => (c ? { ...c, bekleyen: Math.max(0, c.bekleyen - 1) } : c));
    setReportStatus(r.id, "incelendi").catch(() => reload());
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="gear" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Yönetim</Txt>
          </View>
        </View>

        <View style={styles.mainTabs}>
          {["Raporlar", "Kullanıcı"].map((t, i) => (
            <Pressable key={t} onPress={() => { haptic.select(); setMainTab(i); }} style={styles.mainTab}>
              <Txt weight={mainTab === i ? "extrabold" : "medium"} size={14} color={mainTab === i ? "#fff" : "rgba(255,255,255,.42)"}>{t}</Txt>
              {mainTab === i && <Gradient colors={[C.gold, "#C8922B"]} deg={90} style={styles.mainTabUnderline} />}
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.statCard, { borderColor: `${C.red}2E` }]}>
              <Txt weight="displayBold" size={22} color={counts && counts.bekleyen > 0 ? "#FB7185" : C.text}>{counts?.bekleyen ?? "—"}</Txt>
              <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 3 }}>Bekleyen rapor</Txt>
            </View>
            <View style={styles.statCard}>
              <Txt weight="displayBold" size={22} color={C.text}>{counts?.kullanici ?? "—"}</Txt>
              <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 3 }}>Kayıtlı kullanıcı</Txt>
            </View>
          </View>

          {mainTab === 0 ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 10 }}>
                <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, flex: 1 }}>RAPORLAR</Txt>
                {(["Bekleyen", "Tümü"] as const).map((t, i) => (
                  <Pressable key={t} onPress={() => { haptic.select(); setRepTab(i); }} style={[styles.chip, repTab === i && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                    <Txt weight="bold" size={10.5} color={repTab === i ? C.gold2 : C.dim}>{t}</Txt>
                  </Pressable>
                ))}
              </View>

              {shown.length === 0 ? (
                <View style={styles.empty}>
                  <Icon name="check" size={18} sw={2.5} color={C.green} />
                  <Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>{repTab === 0 ? "Bekleyen rapor yok — her şey yolunda." : "Henüz hiç rapor yok."}</Txt>
                </View>
              ) : (
                <View style={styles.group}>
                  {shown.map((r, i) => (
                    <View key={r.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.row}>
                        <View style={[styles.rowIcon, { backgroundColor: r.tip === "kullanici" ? "rgba(251,113,133,.12)" : `${C.purple2}1A` }]}>
                          <Icon name={r.tip === "kullanici" ? "blockuser" : "door"} size={15} color={r.tip === "kullanici" ? "#FB7185" : C.purple2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{r.hedef}</Txt>
                            <Txt weight="bold" size={10.5} color="#FB7185">{r.neden}</Txt>
                            {r.durum === "incelendi" && <View style={styles.donePill}><Txt weight="extrabold" size={8.5} color={C.green}>İNCELENDİ</Txt></View>}
                          </View>
                          {!!r.detay && <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{r.detay}</Txt>}
                          <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{r.raporlayan} raporladı · {zaman(r.at)}</Txt>
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                            {r.durum === "bekliyor" && (
                              <Pressable onPress={() => markReviewed(r)} style={[styles.actChip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                                <Icon name="check" size={11} sw={2.5} color={C.green} /><Txt weight="bold" size={10} color={C.green}>İncelendi</Txt>
                              </Pressable>
                            )}
                            {r.tip === "kullanici" && r.hedefKullaniciId != null && (
                              <Pressable onPress={() => openUser(r.hedefKullaniciId as number)} style={styles.actChip}>
                                <Icon name="user" size={11} color={C.gold} /><Txt weight="bold" size={10} color={C.gold}>Detay</Txt>
                              </Pressable>
                            )}
                            {r.tip === "oda" && r.hedefOdaId != null && (
                              <Pressable onPress={() => openRoomReport(r)} style={styles.actChip}>
                                <Icon name="eye" size={11} color={C.gold} /><Txt weight="bold" size={10} color={C.gold}>Detay</Txt>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={[styles.search, { marginTop: 18 }]}>
                <Icon name="search" size={15} color={C.dim2} />
                <TextInput value={q} onChangeText={setQ} autoCapitalize="none" placeholder="İsim veya ID ara" placeholderTextColor={C.dim2} style={styles.searchInput} />
                {searching ? <ActivityIndicator size="small" color={C.dim} /> : !!q && <Pressable onPress={() => setQ("")}><Icon name="x" size={14} color={C.dim} /></Pressable>}
              </View>
              {results.length > 0 ? (
                <View style={[styles.group, { marginTop: 12 }]}>
                  {results.map((u, i) => (
                    <View key={u.public_id}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable onPress={() => openUser(u.id)} style={styles.userRow}>
                        <Portrait name={u.kullanici_adi} size={44} photo={u.profil_resmi || undefined} ring={u.ekonomi_rolu !== "user" ? C.gold : undefined} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{u.kullanici_adi}</Txt>
                          <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>ID: {u.public_id}{u.seviye_id ? ` · LV.${u.seviye_id}` : ""}</Txt>
                        </View>
                        <Icon name="chev" size={15} color={C.dim2} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : q.trim().length >= 2 && !searching ? (
                <Txt size={12} color={C.dim} align="center" style={{ paddingVertical: 40 }}>Eşleşen kullanıcı yok.</Txt>
              ) : (
                <Txt size={11.5} color={C.dim2} align="center" style={{ paddingVertical: 40 }}>İsim ya da ID ile kullanıcı ara; işlem için dokun.</Txt>
              )}
            </>
          )}

          <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 14 }}>
            Ham veri ve acil müdahale için Supabase Studio'yu da kullanabilirsin; bu ekran günlük moderasyon içindir.
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  mainTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.08)", paddingHorizontal: 18, marginTop: 4 },
  mainTab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  mainTabUnderline: { position: "absolute", bottom: -1, width: 30, height: 3, borderRadius: 3 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 46 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  donePill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: `${C.green}14`, borderWidth: 1, borderColor: `${C.green}44` },
  actChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
  search: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: "600", padding: 0 },
});
