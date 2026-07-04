import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OzelIdGosterim, OzelIdKart as OzelIdKartView } from "@/components/OzelId";
import { PremiumBanner, PREMIUM_FRAMES, PREMIUM_NUM } from "@/components/PremiumBanner";
import { ThroneCard } from "@/components/ThroneCard";
import { Txt } from "@/components/Txt";
import {
  OZEL_ID_KARTLARI,
  OZEL_ID_KART_ADI,
  THRONE_SUPER,
  THRONE_T2,
} from "@/data/specialId";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";


function TierBanner({ label }: { label: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={styles.tierBanner}>
        <Txt size={11} color={C.gold2}>❧</Txt>
        <Txt weight="displayBold" size={13} color={C.gold2}>{label}</Txt>
        <Txt size={11} color={C.gold2}>☙</Txt>
      </View>
    </View>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt size={12} color={C.gold}>◆◇</Txt>
      <Txt weight="displayBold" size={14.5} color={C.gold2} style={{ letterSpacing: 0.5 }}>{children}</Txt>
      <Txt size={12} color={C.gold}>◇◆</Txt>
    </View>
  );
}


// Özel ID kimliği: tip seç (Premium kart 1-5 hane / Kapsül 6-7 hane) →
// istediğin ID'yi gir → tema seç → profil önizlemesi → Onayla → store'a yaz.
function KapsulBolumu() {
  const { ozelId, ozelIdTip, ozelIdTema, setOzelIdKimlik, betaTester } = useApp();
  const claimed = ozelId != null && ozelIdTip != null && ozelIdTema != null;
  const [duzenle, setDuzenle] = useState(false);
  const [tip, setTip] = useState<"premium" | "kapsul">(ozelIdTip ?? "kapsul");
  const [idText, setIdText] = useState(ozelId ?? "");
  const [tema, setTema] = useState<string | null>(ozelIdTema);

  // Premium: ID banner'a baked → sadece seçim yeter. Kapsül: ID gir + tema seç.
  const idGecerli = idText.length >= 6 && idText.length <= 7;
  const hazir = tip === "premium" ? tema != null : idGecerli && tema != null;

  const setTip2 = (t: "premium" | "kapsul") => {
    haptic.select();
    setTip(t);
    setIdText((v) => v.slice(0, t === "premium" ? 5 : 7));
    setTema(null); // premium (banner) ve kapsül (kart) havuzları farklı — sıfırla
  };

  // Zaten tanımlı → mevcut kimlik + Değiştir / Kaldır
  if (claimed && !duzenle) {
    return (
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Txt weight="bold" size={12} color={C.gold2}>Özel ID Kimliğin</Txt>
        <View style={{ marginTop: 14 }}>
          <OzelIdGosterim id={ozelId!} tip={ozelIdTip} tema={ozelIdTema} premiumWidth={250} kapsulSize={16} />
        </View>
        <View style={{ flexDirection: "row", gap: 20, marginTop: 16 }}>
          <Pressable onPress={() => { haptic.light(); setTip(ozelIdTip!); setIdText(ozelId!); setTema(ozelIdTema); setDuzenle(true); }}>
            <Txt weight="extrabold" size={12} color={C.gold2}>Değiştir ↻</Txt>
          </Pressable>
          <Pressable onPress={() => { haptic.light(); setOzelIdKimlik(null, null, null); setIdText(""); setTema(null); }}>
            <Txt weight="extrabold" size={12} color={C.dim}>Kaldır</Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      {betaTester && !claimed && (
        <View style={styles.betaNote}>
          <Txt size={14}>🎖️</Txt>
          <Txt weight="semibold" size={11} color={C.gold2} style={{ flex: 1 }} lh={1.4}>
            Beta Tester olarak <Txt weight="extrabold" size={11} color={C.gold2}>ücretsiz</Txt> kapsül kimlik hakkın var. Aşağıdan seç.
          </Txt>
        </View>
      )}

      {/* Tip seçimi — Premium = hazır banner (listeden seç), Kapsül = kart + ID gir */}
      <View style={styles.tipRow}>
        {([["kapsul", "Kapsül · 6-7 hane"], ["premium", "Premium · Listeden Seç"]] as const).map(([t, l]) => {
          const on = tip === t;
          return (
            <Pressable key={t} onPress={() => setTip2(t)} style={[styles.tipBtn, on && { borderColor: C.gold2, backgroundColor: "rgba(245,206,110,.12)" }]}>
              <Txt weight="extrabold" size={11} color={on ? C.gold2 : C.dim}>{l}</Txt>
            </Pressable>
          );
        })}
      </View>

      {tip === "kapsul" && (
        <>
          <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 14, marginBottom: 6 }}>ID numaranı gir (6 – 7 hane)</Txt>
          <TextInput
            value={idText}
            onChangeText={(t) => setIdText(t.replace(/\D/g, "").slice(0, 7))}
            keyboardType="number-pad"
            maxLength={7}
            placeholder="örn. 123456"
            placeholderTextColor={C.dim2}
            style={styles.idInput}
          />
          {idText.length > 0 && !idGecerli && (
            <Txt weight="semibold" size={10.5} color={C.red} style={{ marginTop: 6 }}>Kapsül ID 6 veya 7 hane olmalı.</Txt>
          )}
        </>
      )}

      <Txt weight="bold" size={12} color={C.gold2} style={{ marginTop: 16, marginBottom: 4 }}>
        {tip === "premium" ? "Premium ID Seç" : "Tema Seç"}
      </Txt>
      {tip === "premium" ? (
        <View style={styles.bannerGrid}>
          {PREMIUM_FRAMES.map((f) => {
            const on = tema === f;
            return (
              <Pressable key={f} onPress={() => { haptic.select(); setTema(f); setIdText(PREMIUM_NUM[f]); }} style={[styles.bannerCell, on && { borderColor: C.gold2, backgroundColor: "rgba(245,206,110,.12)" }]}>
                <PremiumBanner frame={f} width={150} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.kapsulGrid}>
          {OZEL_ID_KARTLARI.map((k) => {
            const on = tema === k;
            return (
              <Pressable key={k} onPress={() => { haptic.select(); setTema(k); }} style={[styles.kapsulCell, on && { borderColor: C.gold2, backgroundColor: "rgba(245,206,110,.12)" }]}>
                <OzelIdKartView frame={k} id="" width={92} />
                <Txt weight="bold" size={8} color={on ? C.gold2 : C.dim2} align="center">{OZEL_ID_KART_ADI[k].sub}</Txt>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Önizleme */}
      {hazir && (
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <Txt weight="semibold" size={11} color={C.dim}>Profilinde böyle görünecek:</Txt>
          <View style={{ marginTop: 12 }}>
            <OzelIdGosterim id={idText} tip={tip} tema={tema} premiumWidth={250} kapsulSize={16} />
          </View>
        </View>
      )}

      <Pressable
        disabled={!hazir}
        onPress={() => { haptic.light(); setOzelIdKimlik(idText, tip, tema); setDuzenle(false); }}
        style={{ marginTop: 18, borderRadius: 999, overflow: "hidden", opacity: hazir ? 1 : 0.4 }}
      >
        <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.uploadBtn}>
          <Txt weight="displayBold" size={14} color="#3A2A05" style={{ letterSpacing: 0.5 }}>Onayla</Txt>
        </Gradient>
      </Pressable>
    </View>
  );
}

export default function SpecialIdScreen() {
  const router = useRouter();
  const { publicId } = useApp();
  const [tab, setTab] = useState(0);

  return (
    <View style={styles.root}>
      <Gradient colors={["#2A2012", "#0B0905"]} deg={180} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.rulesBtn}>
            <Txt weight="bold" size={11} color={C.gold2}>Kurallar</Txt>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Txt weight="displayBold" size={34} color={C.gold2} style={{ letterSpacing: 2 }}>Özel ID</Txt>
        </View>

        <View style={styles.tabs}>
          {["Özel ID Havuzu", "Zenginler Sıralaması"].map((t, i) => {
            const on = i === tab;
            return (
              <Pressable
                key={t}
                onPress={() => { haptic.select(); setTab(i); }}
                style={[styles.tab, { borderTopLeftRadius: i === 0 ? 12 : 0, borderBottomLeftRadius: i === 0 ? 12 : 0, borderTopRightRadius: i === 1 ? 12 : 0, borderBottomRightRadius: i === 1 ? 12 : 0, overflow: "hidden" }]}
              >
                {on ? (
                  <Gradient colors={["#F5CE6E", "#C8922B"]} deg={180} style={styles.tabInner}>
                    <Txt weight="extrabold" size={12.5} color="#3A2A05">{t}</Txt>
                  </Gradient>
                ) : (
                  <View style={[styles.tabInner, { backgroundColor: "rgba(255,255,255,.04)" }]}>
                    <Txt weight="extrabold" size={12.5} color={C.dim}>{t}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <SectionTitle>Özel ID Kimliğin</SectionTitle>
              <View style={styles.profileCard}>
                <View style={{ alignItems: "center" }}>
                  <Txt weight="bold" size={12} color={C.gold2}>Hesap ID'm</Txt>
                  <Txt weight="displayBold" size={22} color="#fff" style={{ marginTop: 6, letterSpacing: 1 }}>{publicId || "—"}</Txt>
                </View>
                <Gradient colors={["transparent", `${C.gold}66`, "transparent"]} deg={90} style={styles.profileDivider} />
                <KapsulBolumu />
                <View style={styles.statGrid}>
                  {([["Bu Ay Yüklenen Altın", "0"], ["Bu Ayki Seviye", "Yok"], ["Bu Ayki Sıralama", "0"], ["Geçen Ayki Seviye", "Yok"]] as const).map(([l, v]) => (
                    <View key={l} style={styles.statRow}>
                      <Txt weight="semibold" size={10.5} color={C.dim} style={{ flex: 1 }}>{l}</Txt>
                      <View style={styles.statVal}>
                        <Txt weight="extrabold" size={11.5} color={C.text}>{v}</Txt>
                      </View>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => { haptic.light(); router.navigate("/diamond-load"); }} style={{ marginTop: 18, borderRadius: 999, overflow: "hidden" }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.uploadBtn}>
                    <Txt weight="displayBold" size={14} color="#3A2A05" style={{ letterSpacing: 0.5 }}>Yükleme Yap</Txt>
                  </Gradient>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={{ marginTop: 20, marginBottom: 12 }}>
                <TierBanner label="Süper Özel ID" />
              </View>
              <View style={{ paddingHorizontal: 40 }}>
                <ThroneCard id={THRONE_SUPER.id} name={THRONE_SUPER.name} big />
              </View>

              <View style={{ marginTop: 24, marginBottom: 14 }}>
                <TierBanner label="2. Seviye Özel ID" />
              </View>
              <View style={styles.throneGrid}>
                {THRONE_T2.map((e) => (
                  <View key={e.id} style={{ width: "45%" }}>
                    <ThroneCard id={e.id} name={e.name} />
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  rulesBtn: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,.3)", alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginHorizontal: 16 },
  tab: { flex: 1 },
  tabInner: { paddingVertical: 11, alignItems: "center" },
  tierBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 22, borderRadius: 8, backgroundColor: "#241805", borderWidth: 1.5, borderColor: `${C.gold}55` },
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 22, marginBottom: 14 },
  profileCard: { borderRadius: 18, padding: 16, paddingVertical: 18, backgroundColor: "rgba(245,206,110,.06)", borderWidth: 1, borderColor: `${C.gold}33` },
  profileDivider: { alignSelf: "stretch", height: 2, marginTop: 8 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  statRow: { width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statVal: { minWidth: 54, paddingVertical: 7, borderRadius: 8, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, alignItems: "center" },
  uploadBtn: { paddingVertical: 15, alignItems: "center" },
  throneGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18, columnGap: 14 },
  betaNote: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 12, backgroundColor: "rgba(245,206,110,.08)", borderWidth: 1, borderColor: `${C.gold}44`, marginBottom: 6 },
  kapsulGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  kapsulCell: { width: 104, alignItems: "center", gap: 3, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  bannerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  bannerCell: { alignItems: "center", padding: 6, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  tipRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  tipBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  idInput: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: `${C.gold}44`, backgroundColor: "rgba(0,0,0,.3)", paddingHorizontal: 16, color: "#fff", fontSize: 18, letterSpacing: 2, fontFamily: "PlusJakartaSans_800ExtraBold" },
});
