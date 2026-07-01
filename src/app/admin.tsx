import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { getAdminCounts, setPlatformRole } from "@/data/remote/adminRepo";
import { listReports, setReportStatus, type ReportRow } from "@/data/remote/reportRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function zaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminScreen() {
  const router = useRouter();
  const role = useApp((s) => s.role);
  const [tab, setTab] = useState(0); // 0: bekleyen, 1: tümü
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [counts, setCounts] = useState<{ bekleyen: number; kullanici: number } | null>(null);
  const [roleSheet, setRoleSheet] = useState<ReportRow | null>(null);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    listReports().then(setReports).catch((e) => console.warn("[admin] raporlar:", e?.message || e));
    getAdminCounts().then(setCounts).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const shown = tab === 0 ? reports.filter((r) => r.durum === "bekliyor") : reports;

  const markReviewed = (r: ReportRow) => {
    haptic.success();
    setReports((rs) => rs.map((x) => (x.id === r.id ? { ...x, durum: "incelendi" } : x)));
    setCounts((c) => (c ? { ...c, bekleyen: Math.max(0, c.bekleyen - 1) } : c));
    setReportStatus(r.id, "incelendi").catch(() => reload());
  };
  const openTargetProfile = (r: ReportRow) => {
    if (r.tip !== "kullanici" || !r.hedefPublicId) return;
    haptic.light();
    router.navigate(`/user-profile?publicId=${encodeURIComponent(r.hedefPublicId)}&name=${encodeURIComponent(r.hedef)}`);
  };
  const assignRole = (rol: "user" | "developer" | "super_admin") => {
    const target = roleSheet;
    setRoleSheet(null);
    if (!target?.hedefKullaniciId) return;
    haptic.success();
    setPlatformRole(target.hedefKullaniciId, rol).catch((e) => console.warn("[admin] rol:", e?.message || e));
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

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
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

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 10 }}>
            <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, flex: 1 }}>RAPORLAR</Txt>
            {(["Bekleyen", "Tümü"] as const).map((t, i) => (
              <Pressable key={t} onPress={() => { haptic.select(); setTab(i); }} style={[styles.tabChip, tab === i && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                <Txt weight="bold" size={10.5} color={tab === i ? C.gold2 : C.dim}>{t}</Txt>
              </Pressable>
            ))}
          </View>

          {shown.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="check" size={18} sw={2.5} color={C.green} />
              <Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>
                {tab === 0 ? "Bekleyen rapor yok — her şey yolunda." : "Henüz hiç rapor yok."}
              </Txt>
            </View>
          ) : (
            <View style={styles.group}>
              {shown.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: r.tip === "kullanici" ? "rgba(251,113,133,.12)" : `${C.purple2}1A` }]}>
                      <Icon name={r.tip === "kullanici" ? "blockuser" : "mic"} size={15} color={r.tip === "kullanici" ? "#FB7185" : C.purple2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{r.hedef}</Txt>
                        <Txt weight="bold" size={10.5} color="#FB7185">{r.neden}</Txt>
                        {r.durum === "incelendi" && (
                          <View style={styles.donePill}>
                            <Txt weight="extrabold" size={8.5} color={C.green}>İNCELENDİ</Txt>
                          </View>
                        )}
                      </View>
                      {!!r.detay && <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{r.detay}</Txt>}
                      <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{r.raporlayan} raporladı · {zaman(r.at)}</Txt>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 7 }}>
                        {r.durum === "bekliyor" && (
                          <Pressable onPress={() => markReviewed(r)} style={[styles.actChip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                            <Icon name="check" size={11} sw={2.5} color={C.green} />
                            <Txt weight="bold" size={10} color={C.green}>İncelendi</Txt>
                          </Pressable>
                        )}
                        {r.tip === "kullanici" && (
                          <Pressable onPress={() => openTargetProfile(r)} style={styles.actChip}>
                            <Icon name="user" size={11} color={C.dim} />
                            <Txt weight="bold" size={10} color={C.dim}>Profil</Txt>
                          </Pressable>
                        )}
                        {r.tip === "kullanici" && role === "super_admin" && (
                          <Pressable onPress={() => setRoleSheet(r)} style={styles.actChip}>
                            <Icon name="crown" size={11} color={C.gold} />
                            <Txt weight="bold" size={10} color={C.gold}>Rol</Txt>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 14 }}>
            Ham veri ve acil müdahale için Supabase Studio'yu kullanabilirsin; bu ekran günlük moderasyon içindir.
          </Txt>
        </ScrollView>
      </SafeAreaView>

      {/* Rol atama (yalnızca super_admin) */}
      <Sheet visible={!!roleSheet} onClose={() => setRoleSheet(null)}>
        {roleSheet && (
          <>
            <Txt weight="displayBold" size={15} color="#fff" style={{ marginBottom: 4 }}>{roleSheet.hedef} için rol</Txt>
            <Txt size={11} color={C.dim} style={{ marginBottom: 12 }}>Platform rolünü değiştir (geri alınabilir).</Txt>
            {([
              { k: "user" as const, t: "Kullanıcı", s: "Standart hesap" },
              { k: "developer" as const, t: "Geliştirici", s: "Yetkili rozeti + yönetim ekranı" },
              { k: "super_admin" as const, t: "Süper Yönetici", s: "Tüm yetkiler + rol atama" },
            ]).map((o) => (
              <Pressable key={o.k} onPress={() => assignRole(o.k)} style={styles.roleRow}>
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={13} color={C.text}>{o.t}</Txt>
                  <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{o.s}</Txt>
                </View>
                <Icon name="chev" size={14} color={C.dim2} />
              </Pressable>
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  statCard: { flex: 1, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  tabChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 58 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  donePill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: `${C.green}14`, borderWidth: 1, borderColor: `${C.green}44` },
  actChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)", marginBottom: 8 },
});
