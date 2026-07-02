import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { getUserDetail, type AdminUserDetail } from "@/data/remote/adminRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const ROLE_LABEL: Record<string, string> = { user: "Kullanıcı", developer: "Geliştirici", super_admin: "Süper Yönetici" };
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function kayit(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

function SectionRow({ icon, tint, title, sub, danger, onPress }: {
  icon: IconName; tint: string; title: string; sub: string; danger?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.secRow}>
      <View style={[styles.secIcon, { backgroundColor: `${tint}1A` }]}><Icon name={icon} size={16} color={tint} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight="bold" size={13.5} color={C.text}>{title}</Txt>
        <Txt size={10.5} color={danger ? "#FB7185" : C.dim} style={{ marginTop: 2 }} numberOfLines={1}>{sub}</Txt>
      </View>
      <Icon name="chev" size={15} color={C.dim2} />
    </Pressable>
  );
}

export default function AdminUserHub() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId ? parseInt(String(params.userId), 10) : NaN;

  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!Number.isFinite(userId)) { setErr("Kullanıcı bulunamadı."); setLoading(false); return; }
    setLoading(true); setErr(null);
    getUserDetail(userId)
      .then((r) => { if (r) setD(r); else setErr("Kullanıcı bulunamadı."); })
      .catch((e) => setErr(e?.message || "Kullanıcı bilgisi alınamadı."))
      .finally(() => setLoading(false));
  }, [userId]);
  // Alt düzenleme sayfasından dönünce tazele
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const go = (section: string) => { haptic.light(); router.navigate(`/admin-user-edit?userId=${userId}&section=${section}`); };

  const ekoSub = d ? [
    d.elmasDondu ? "Elmas donduruldu" : null,
    d.altinDondu ? "Altın donduruldu" : null,
  ].filter(Boolean).join(" · ") || "Elmas/altın ver-al, dondur" : "";
  const cezaSub = d ? [
    d.micBanned ? "Mic yasaklı" : null,
    d.hesapYasakli ? "Hesap yasaklı" : null,
  ].filter(Boolean).join(" · ") || "Mic yasağı, hesap yasağı" : "";

  return (
    <View style={styles.root}>
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="user" size={16} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Kullanıcı Yönetimi</Txt>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold} /></View>
        ) : err || !d ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
            <Icon name="warn" size={26} color="#FB7185" />
            <Txt size={12.5} color={C.dim} align="center" lh={1.5}>{err || "Kullanıcı bulunamadı."}</Txt>
            <Pressable onPress={load} style={[styles.chip, { paddingHorizontal: 18 }]}><Txt weight="bold" size={12} color={C.gold2}>Tekrar dene</Txt></Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Kimlik kartı */}
            <View style={[styles.group, { padding: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Portrait name={d.name} size={54} photo={d.photo} ring={d.rol === "user" ? undefined : C.gold} glow={d.rol !== "user"} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1}>{d.name}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                    <Txt weight="semibold" size={11} color={C.dim}>ID: {d.publicId}</Txt>
                    <View style={styles.rolePill}><Txt weight="extrabold" size={9} color={C.gold2}>{ROLE_LABEL[d.rol] || d.rol}</Txt></View>
                  </View>
                  {!!d.email && <Txt size={10.5} color={C.dim2} style={{ marginTop: 3 }} numberOfLines={1}>{d.email}</Txt>}
                  {!!d.kayitTarihi && <Txt size={10} color={C.dim2} style={{ marginTop: 2 }}>Kayıt: {kayit(d.kayitTarihi)}</Txt>}
                </View>
              </View>
              {(d.hesapYasakli || d.micBanned) && (
                <View style={styles.warnStrip}>
                  <Icon name="ban" size={13} color="#FB7185" />
                  <Txt weight="bold" size={11} color="#FB7185" style={{ flex: 1 }}>
                    {d.hesapYasakli ? "Hesabı uygulamadan yasaklı" : "Mikrofonu yasaklı"}
                  </Txt>
                </View>
              )}
            </View>

            {/* Özet */}
            <View style={styles.summary}>
              <View style={styles.sumCol}><DiamondBadge size={15} /><Txt weight="displayBold" size={15} color={d.elmasDondu ? "#7DD3FC" : "#fff"}>{d.elmas.toLocaleString("tr-TR")}</Txt>{d.elmasDondu && <Icon name="lock" size={9} color="#7DD3FC" />}</View>
              <View style={styles.sumDiv} />
              <View style={styles.sumCol}><CoinBadge size={15} /><Txt weight="displayBold" size={15} color={d.altinDondu ? "#FCD34D" : "#fff"}>{d.altin.toLocaleString("tr-TR")}</Txt>{d.altinDondu && <Icon name="lock" size={9} color="#FCD34D" />}</View>
              <View style={styles.sumDiv} />
              <View style={styles.sumCol}><Txt weight="displayBold" size={15} color="#5EEAD4">LV.{d.level}</Txt></View>
              <View style={styles.sumDiv} />
              <View style={styles.sumCol}><Txt weight="displayBold" size={15} color={d.raporSayisi > 0 ? "#FB7185" : "#fff"}>{d.raporSayisi}</Txt><Txt size={8.5} color={C.dim2}>rapor</Txt></View>
            </View>

            {/* Bölümler */}
            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>YÖNETİM BÖLÜMLERİ</Txt>
            <View style={styles.group}>
              <SectionRow icon="evDiamond" tint="#5EEAD4" title="Ekonomi" sub={ekoSub} danger={d.elmasDondu || d.altinDondu} onPress={() => go("economy")} />
              <View style={styles.divider} />
              <SectionRow icon="ban" tint="#FB7185" title="Cezai İşlemler" sub={cezaSub} danger={d.micBanned || d.hesapYasakli} onPress={() => go("penalty")} />
              <View style={styles.divider} />
              <SectionRow icon="idcard" tint={C.gold} title="Kimlik & Bilgi" sub="Ad, avatar, e-posta, kayıt tarihi" onPress={() => go("identity")} />
              <View style={styles.divider} />
              <SectionRow icon="clipboard" tint={C.purple2} title="İşlem Geçmişi" sub="Kim, ne zaman, kaç kez işlem yaptı" onPress={() => go("history")} />
            </View>

            <Pressable onPress={() => { haptic.light(); router.navigate(`/user-profile?publicId=${encodeURIComponent(d.publicId)}&name=${encodeURIComponent(d.name)}`); }} style={[styles.group, styles.profileBtn]}>
              <Icon name="user" size={15} color={C.text} /><Txt weight="bold" size={12.5} color={C.text} style={{ flex: 1 }}>Herkese Açık Profili Gör</Txt><Icon name="chev" size={13} color={C.dim2} />
            </Pressable>
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 60 },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  rolePill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}44` },
  warnStrip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)" },
  summary: { flexDirection: "row", marginTop: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line, paddingVertical: 12 },
  sumCol: { flex: 1, alignItems: "center", gap: 3 },
  sumDiv: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  secRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13, paddingHorizontal: 13 },
  secIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  profileBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, marginTop: 14 },
});
