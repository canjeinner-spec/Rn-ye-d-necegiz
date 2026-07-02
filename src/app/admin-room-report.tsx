import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { getReport, setReportStatus, type ReportRow } from "@/data/remote/reportRepo";
import { getRoomReportDetail, type RoomReportDetail } from "@/data/remote/roomsRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function zaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function saat(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AdminRoomReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ odaId?: string; sikayetId?: string }>();
  const odaId = params.odaId ? parseInt(String(params.odaId), 10) : NaN;
  const sikayetId = params.sikayetId ? parseInt(String(params.sikayetId), 10) : NaN;

  const [detail, setDetail] = useState<RoomReportDetail | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!Number.isFinite(odaId)) { setErr("Oda bulunamadı."); setLoading(false); return; }
    setLoading(true); setErr(null);
    Promise.all([
      getRoomReportDetail(odaId),
      Number.isFinite(sikayetId) ? getReport(sikayetId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([d, r]) => { setDetail(d); setReport(r); })
      .catch((e) => setErr(e?.message || "Detay alınamadı."))
      .finally(() => setLoading(false));
  }, [odaId, sikayetId]);
  useEffect(() => { load(); }, [load]);

  const openUser = (uid: number) => { haptic.light(); router.navigate(`/admin-user?userId=${uid}`); };
  const openEdit = () => { haptic.light(); router.navigate(`/admin-room-edit?odaId=${odaId}`); };

  const markReviewed = () => {
    if (!report) return;
    haptic.success();
    setReport((r) => (r ? { ...r, durum: "incelendi" } : r));
    setReportStatus(report.id, "incelendi").catch(() => load());
  };

  const oda = detail?.oda;
  const snapshot = report?.odaKatilimcilar ?? [];

  // Rapor anından itibaren hareket (rapor zamanı biliniyorsa)
  const sinceMoves = report ? (detail?.hareketler ?? []).filter((h) => h.at >= report.at) : [];
  const girenSonra = new Set(sinceMoves.filter((h) => h.tip === "giris").map((h) => h.uid)).size;
  const cikanSonra = new Set(sinceMoves.filter((h) => h.tip === "cikis").map((h) => h.uid)).size;

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="door" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Oda Rapor Detayı</Txt>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold} /></View>
        ) : err ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
            <Icon name="warn" size={26} color="#FB7185" />
            <Txt size={12.5} color={C.dim} align="center" lh={1.5}>{err}</Txt>
            <Pressable onPress={load} style={[styles.chip, { paddingHorizontal: 18 }]}><Txt weight="bold" size={12} color={C.gold2}>Tekrar dene</Txt></Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Rapor özeti */}
            {report && (
              <View style={[styles.group, { padding: 13, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 }]}>
                <View style={[styles.rowIcon, { backgroundColor: `${C.purple2}1A` }]}><Icon name="flag" size={15} color={C.purple2} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Txt weight="bold" size={12} color="#FB7185">{report.neden}</Txt>
                    {report.durum === "incelendi" && <View style={styles.donePill}><Txt weight="extrabold" size={8.5} color={C.green}>İNCELENDİ</Txt></View>}
                  </View>
                  {!!report.detay && <Txt size={11} color={C.dim} lh={1.4} style={{ marginTop: 3 }}>{report.detay}</Txt>}
                  <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>{report.raporlayan} raporladı · {zaman(report.at)}</Txt>
                </View>
                {report.durum === "bekliyor" && (
                  <Pressable onPress={markReviewed} style={[styles.actChip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                    <Icon name="check" size={11} sw={2.5} color={C.green} /><Txt weight="bold" size={10} color={C.green}>İncelendi</Txt>
                  </Pressable>
                )}
              </View>
            )}

            {/* Oda bilgileri */}
            <View style={[styles.lbl, { flexDirection: "row", alignItems: "center" }]}>
              <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, flex: 1 }}>ODA BİLGİLERİ</Txt>
              {oda && (
                <Pressable onPress={openEdit} style={styles.actChip}>
                  <Icon name="edit" size={11} color={C.gold} /><Txt weight="bold" size={10} color={C.gold}>Düzenle</Txt>
                </Pressable>
              )}
            </View>
            {oda ? (
              <View style={styles.group}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}>
                  <Portrait name={oda.name} size={52} photo={oda.photo} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="displayBold" size={15} color="#fff" numberOfLines={1}>{oda.name}</Txt>
                    <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 3 }}>ID: {oda.publicId} · Sahip: {oda.hostName}</Txt>
                    {!!oda.aciklama && <Txt size={11} color={C.dim2} lh={1.4} style={{ marginTop: 4 }} numberOfLines={2}>{oda.aciklama}</Txt>}
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.metrics}>
                  <View style={styles.metricCol}><Txt weight="displayBold" size={16} color="#fff">{oda.aktifKatilimci}</Txt><Txt size={9} color={C.dim2}>şu an</Txt></View>
                  <View style={styles.metricDiv} />
                  <View style={styles.metricCol}><Txt weight="displayBold" size={16} color="#fff">{oda.uyeSayisi}</Txt><Txt size={9} color={C.dim2}>üye</Txt></View>
                  <View style={styles.metricDiv} />
                  <View style={styles.metricCol}><Txt weight="displayBold" size={16} color="#5EEAD4">{detail?.girenSayisi ?? 0}</Txt><Txt size={9} color={C.dim2}>giren</Txt></View>
                  <View style={styles.metricDiv} />
                  <View style={styles.metricCol}><Txt weight="displayBold" size={16} color="#FB7185">{detail?.cikanSayisi ?? 0}</Txt><Txt size={9} color={C.dim2}>çıkan</Txt></View>
                </View>
                {report && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.sinceRow}>
                      <Icon name="flag" size={12} color={C.purple2} />
                      <Txt size={10.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Rapordan beri</Txt>
                      <Txt weight="bold" size={11} color="#5EEAD4">{girenSonra} giren</Txt>
                      <Txt size={10} color={C.dim2}>·</Txt>
                      <Txt weight="bold" size={11} color="#FB7185">{cikanSonra} çıkan</Txt>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.empty}><Icon name="warn" size={16} color={C.dim} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Oda silinmiş ya da erişilemiyor.</Txt></View>
            )}

            {/* Rapor anında odada (snapshot) */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>RAPOR ANINDA ODADA ({snapshot.length})</Txt>
            {snapshot.length > 0 ? (
              <View style={styles.group}>
                {snapshot.map((o, i) => (
                  <View key={o.uid}>
                    {i > 0 && <View style={styles.divider} />}
                    <Pressable onPress={() => openUser(o.uid)} style={styles.personRow}>
                      <Portrait name={o.name} size={40} photo={o.photo} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt weight="bold" size={12.5} color={C.text} numberOfLines={1}>{o.name}</Txt>
                        {!!o.publicId && <Txt size={10} color={C.dim2} style={{ marginTop: 2 }}>ID: {o.publicId}</Txt>}
                      </View>
                      <Icon name="chev" size={14} color={C.dim2} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.empty}><Icon name="users" size={16} color={C.dim} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Rapor anındaki katılımcı listesi kaydedilmemiş.</Txt></View>
            )}

            {/* Giriş / çıkış geçmişi */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>GİRİŞ / ÇIKIŞ GEÇMİŞİ</Txt>
            {detail && detail.hareketler.length > 0 ? (
              <View style={styles.group}>
                {detail.hareketler.map((h, i) => {
                  const giris = h.tip === "giris";
                  return (
                    <View key={h.id}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable onPress={() => openUser(h.uid)} style={styles.personRow}>
                        <Portrait name={h.name} size={36} photo={h.photo} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="bold" size={12} color={C.text} numberOfLines={1}>{h.name}</Txt>
                          {!!h.publicId && <Txt size={9.5} color={C.dim2} style={{ marginTop: 2 }}>ID: {h.publicId}</Txt>}
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <View style={[styles.tipPill, { backgroundColor: giris ? "rgba(94,234,212,.12)" : "rgba(251,113,133,.12)", borderColor: giris ? "rgba(94,234,212,.3)" : "rgba(251,113,133,.3)" }]}>
                            <Icon name="door" size={10} color={giris ? "#5EEAD4" : "#FB7185"} />
                            <Txt weight="extrabold" size={9} color={giris ? "#5EEAD4" : "#FB7185"}>{giris ? "GİRDİ" : "ÇIKTI"}</Txt>
                          </View>
                          <Txt size={9.5} color={C.dim2}>{saat(h.at)}</Txt>
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.empty}><Icon name="door" size={16} color={C.dim} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Bu oda için giriş/çıkış kaydı yok.</Txt></View>
            )}

            <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 16 }}>
              "Giren" sayısı kesindir; "çıkan" en iyi çabayla kaydedilir (uygulama zorla kapanırsa çıkış düşmeyebilir). Bir kişiye dokununca kullanıcı detayı açılır.
            </Txt>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 46 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  actChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  donePill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: `${C.green}14`, borderWidth: 1, borderColor: `${C.green}44` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  metrics: { flexDirection: "row", paddingVertical: 12 },
  sinceRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10, paddingHorizontal: 14 },
  metricCol: { flex: 1, alignItems: "center", gap: 3 },
  metricDiv: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  tipPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1 },
  empty: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line },
});
