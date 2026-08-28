import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KopyaBtn } from "@/components/KopyaBtn";
import { OzelIdGosterim, OzelIdKart as OzelIdKartView } from "@/components/OzelId";
import { PremiumBanner, PREMIUM_FRAMES } from "@/components/PremiumBanner";
import { Tabs } from "@/components/Tabs";
import { ThroneCard } from "@/components/ThroneCard";
import { Txt } from "@/components/Txt";
import {
  OZEL_ID_KARTLARI,
  OZEL_ID_KART_ADI,
  THRONE_SUPER,
  THRONE_T2,
} from "@/data/specialId";
import { clearOzelId, setOzelId } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";


/** Sıralama bölüm başlığı — iki yanında ince altın çizgi. */
function TierBanner({ label }: { label: string }) {
  return (
    <View style={styles.tierRow}>
      <Gradient colors={["transparent", C.gold + "66"]} deg={90} style={styles.tierLine} />
      <View style={styles.tierBanner}>
        <Icon name="crown" size={12} color={C.gold2} />
        <Txt weight="displayBold" size={12.5} color={C.gold2}>{label}</Txt>
      </View>
      <Gradient colors={[C.gold + "66", "transparent"]} deg={90} style={styles.tierLine} />
    </View>
  );
}

/** Bölüm başlığı — eskiden ◆◇ / ◇◆ süslemeleri vardı. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}


// Özel ID kimliği: tip seç (Premium kart 1-5 hane / Kapsül 6-7 hane) →
// istediğin ID'yi gir → tema seç → profil önizlemesi → Onayla → store'a yaz.
function KapsulBolumu() {
  const { ozelId, ozelIdTip, ozelIdTema, setOzelIdKimlik, betaTester, premiumHak } = useApp();
  const claimed = ozelId != null && ozelIdTip != null && ozelIdTema != null;
  // Yetki (entitlement): kapsül → beta veya premium hak; premium → yalnız premium hak.
  const kapsulYetki = betaTester || premiumHak;
  const premiumYetki = premiumHak;
  const hicYetki = !kapsulYetki && !premiumYetki;
  const [duzenle, setDuzenle] = useState(false);
  const [tip, setTip] = useState<"premium" | "kapsul">(ozelIdTip ?? (premiumYetki && !betaTester ? "premium" : "kapsul"));
  const [idText, setIdText] = useState(ozelId ?? "");
  const [tema, setTema] = useState<string | null>(ozelIdTema);
  const [kaydet, setKaydet] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // Her iki tipte de: ID gir + tema/çerçeve seç.
  // Premium 1-5 hane, kapsül 6-7 hane (sunucudaki ozel_id_ayarla da bunu zorlar).
  // NOT: Eskiden premium'da ID görsele çizili geldiği için yalnızca seçim
  // yetiyordu; artık ID'yi uygulama yazıyor, o yüzden girilmesi gerekiyor.
  const idGecerli = tip === "premium"
    ? idText.length >= 1 && idText.length <= 5
    : idText.length >= 6 && idText.length <= 7;
  const secili = idGecerli && tema != null;
  const hazir = secili && !kaydet;

  const setTip2 = (t: "premium" | "kapsul") => {
    haptic.select();
    setTip(t);
    setIdText((v) => v.slice(0, t === "premium" ? 5 : 7));
    setTema(null); // premium (banner) ve kapsül (kart) havuzları farklı — sıfırla
    setHata(null);
  };

  const onayla = async () => {
    if (!hazir) return;
    haptic.light();
    setHata(null);
    if (isSupabaseConfigured) {
      setKaydet(true);
      try {
        await setOzelId(idText, tip, tema!);
      } catch (e) {
        setHata((e as { message?: string })?.message || "Kaydedilemedi, tekrar dene.");
        setKaydet(false);
        return;
      }
      setKaydet(false);
    }
    setOzelIdKimlik(idText, tip, tema);
    setDuzenle(false);
  };

  const kaldir = async () => {
    haptic.light();
    if (isSupabaseConfigured) { try { await clearOzelId(); } catch { /* yoksay */ } }
    setOzelIdKimlik(null, null, null);
    setIdText(""); setTema(null);
  };

  // Zaten tanımlı → mevcut kimlik + Değiştir / Kaldır
  if (claimed && !duzenle) {
    return (
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Txt weight="bold" size={12} color={C.gold2}>Özel ID Kimliğin</Txt>
        <View style={{ marginTop: 14 }}>
          <OzelIdGosterim id={ozelId!} tip={ozelIdTip} tema={ozelIdTema} premiumWidth={250} kapsulSize={16} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Pressable onPress={() => { haptic.light(); setTip(ozelIdTip!); setIdText(ozelId!); setTema(ozelIdTema); setDuzenle(true); }} style={[styles.altBtn, { borderColor: C.gold + "55", backgroundColor: C.gold + "14" }]}>
            <Icon name="edit" size={13} color={C.gold2} />
            <Txt weight="extrabold" size={12} color={C.gold2}>Değiştir</Txt>
          </Pressable>
          <Pressable onPress={kaldir} style={styles.altBtn}>
            <Icon name="trash" size={13} color={C.dim} />
            <Txt weight="extrabold" size={12} color={C.dim}>Kaldır</Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  // Hiç yetki yok → claim tamamen kapalı (kimse kafasına göre özel ID alamaz)
  if (hicYetki) {
    return (
      <View style={{ alignItems: "center", marginTop: 18 }}>
        <View style={styles.kilitIkon}>
          <Icon name="lock" size={19} color={C.gold} />
        </View>
        <Txt weight="bold" size={12.5} color={C.gold2} align="center" style={{ marginTop: 10 }}>Özel ID hakkın yok</Txt>
        <Txt size={11} color={C.dim} lh={1.5} align="center" style={{ marginTop: 6 }}>
          Kapsül ID için Beta Tester olman, premium ID için yetkili ataması gerekir. Hak verilince buradan alabilirsin.
        </Txt>
      </View>
    );
  }

  const tipler = [
    ...(kapsulYetki ? [["kapsul", "Kapsül · 6-7 hane"] as const] : []),
    ...(premiumYetki ? [["premium", "Premium · 1-5 hane"] as const] : []),
  ];

  return (
    <View style={{ marginTop: 16 }}>
      {kapsulYetki && !premiumHak && !claimed && (
        <View style={styles.betaNote}>
          <View style={styles.betaIkon}>
            <Icon name="idcard" size={13} color={C.gold2} />
          </View>
          <Txt weight="semibold" size={11} color={C.gold2} style={{ flex: 1 }} lh={1.4}>
            Beta Tester olarak <Txt weight="extrabold" size={11} color={C.gold2}>ücretsiz</Txt> kapsül kimlik hakkın var. Aşağıdan seç.
          </Txt>
        </View>
      )}

      {/* Tip seçimi — yalnız HAK EDİLEN tipler görünür */}
      {tipler.length > 1 && (
        <View style={styles.tipRow}>
          {tipler.map(([t, l]) => {
            const on = tip === t;
            return (
              <Pressable key={t} onPress={() => setTip2(t)} style={[styles.tipBtn, on && { borderColor: C.gold2, backgroundColor: "rgba(245,206,110,.12)" }]}>
                <Txt weight="extrabold" size={11} color={on ? C.gold2 : C.dim}>{l}</Txt>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ID girişi her iki tipte de gerekli — premium'da da ID'yi artık
          uygulama yazıyor, görsele çizili gelmiyor. */}
      <Txt weight="semibold" size={11} color={C.dim} style={{ marginTop: 14, marginBottom: 6 }}>
        {tip === "premium" ? "ID numaranı gir (1 – 5 hane)" : "ID numaranı gir (6 – 7 hane)"}
      </Txt>
      <TextInput
        value={idText}
        onChangeText={(t) => setIdText(t.replace(/\D/g, "").slice(0, tip === "premium" ? 5 : 7))}
        keyboardType="number-pad"
        maxLength={tip === "premium" ? 5 : 7}
        placeholder={tip === "premium" ? "örn. 4783" : "örn. 123456"}
        placeholderTextColor={C.dim2}
        style={styles.idInput}
      />
      {idText.length > 0 && !idGecerli && (
        <Txt weight="semibold" size={10.5} color={C.red} style={{ marginTop: 6 }}>
          {tip === "premium" ? "Premium ID en fazla 5 hane olmalı." : "Kapsül ID 6 veya 7 hane olmalı."}
        </Txt>
      )}

      <Txt weight="bold" size={12} color={C.gold2} style={{ marginTop: 16, marginBottom: 4 }}>
        {tip === "premium" ? "Çerçeve Seç" : "Tema Seç"}
      </Txt>
      {tip === "premium" ? (
        <View style={styles.bannerGrid}>
          {PREMIUM_FRAMES.map((f) => {
            const on = tema === f;
            return (
              <Pressable key={f} onPress={() => { haptic.select(); setTema(f); }} style={[styles.bannerCell, on && { borderColor: C.gold2, backgroundColor: "rgba(245,206,110,.12)" }]}>
                {/* Girilen ID çerçevenin içinde canlı önizlenir */}
                <PremiumBanner frame={f} id={idText || undefined} width={150} />
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
      {secili && (
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <Txt weight="semibold" size={11} color={C.dim}>Profilinde böyle görünecek:</Txt>
          <View style={{ marginTop: 12 }}>
            <OzelIdGosterim id={idText} tip={tip} tema={tema} premiumWidth={250} kapsulSize={16} />
          </View>
        </View>
      )}

      {hata && <Txt weight="semibold" size={10.5} color={C.red} align="center" style={{ marginTop: 12 }}>{hata}</Txt>}

      <Pressable
        disabled={!hazir}
        onPress={onayla}
        style={{ marginTop: 14, borderRadius: 999, overflow: "hidden", opacity: hazir ? 1 : 0.4 }}
      >
        <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.uploadBtn}>
          <Txt weight="displayBold" size={14} color="#3A2A05" style={{ letterSpacing: 0.5 }}>{kaydet ? "Kaydediliyor…" : "Onayla"}</Txt>
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
      {/* Zemin diğer ekranlarla aynı siyah-altın; eskiden kahverengiydi
          (#2A2012 → #0B0905) ve tek başına duruyordu. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "24", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={17} color="#fff">Özel ID</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* Sekmeler: iki bitişik gradyan buton yerine kayan alt çizgi */}
        <Tabs items={["Özel ID Havuzu", "Zenginler"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            <>
              <SectionTitle>HESABIM</SectionTitle>
              <View style={styles.profileCard}>
                <Gradient colors={[C.gold + "16", "transparent"]} deg={160} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.cardSheen} pointerEvents="none" />
                <View style={{ alignItems: "center" }}>
                  <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.6 }}>HESAP ID'M</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
                    <Txt weight="displayBold" size={22} color="#fff" style={{ letterSpacing: 1 }}>{publicId || "—"}</Txt>
                    <KopyaBtn deger={publicId} size={13} />
                  </View>
                </View>
                <View style={styles.profileDivider} />
                {/* Buradaki dört kutuluk "Bu Ay Yüklenen Altın / Bu Ayki Seviye /
                    Sıralama" tablosu tamamen yer tutucuydu (hep 0 ve "Yok");
                    besleyecek bir veri kaynağı yok, kaldırıldı. */}
                <KapsulBolumu />
              </View>

              <Pressable onPress={() => { haptic.light(); router.navigate("/diamond-load"); }} style={{ marginTop: 14, borderRadius: 16, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.uploadBtn}>
                  <Txt weight="extrabold" size={13.5} color="#3A2A05">Yükleme Yap</Txt>
                </Gradient>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ marginTop: 18, marginBottom: 16 }}>
                <TierBanner label="Süper Özel ID" />
              </View>
              <View style={{ paddingHorizontal: 52 }}>
                <ThroneCard id={THRONE_SUPER.id} name={THRONE_SUPER.name} big />
              </View>

              <View style={{ marginTop: 26, marginBottom: 18 }}>
                <TierBanner label="2. Seviye Özel ID" />
              </View>
              <View style={styles.throneGrid}>
                {THRONE_T2.map((e) => (
                  <View key={e.id} style={{ width: "47%" }}>
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
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tierLine: { flex: 1, height: StyleSheet.hairlineWidth },
  tierBanner: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.gold + "14", borderWidth: 1, borderColor: `${C.gold}4D` },
  sectionTitle: { letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  profileCard: { borderRadius: 20, padding: 16, paddingVertical: 18, backgroundColor: "rgba(18,15,24,.72)", borderWidth: 1, borderColor: `${C.gold}3D`, overflow: "hidden" },
  cardSheen: { position: "absolute", top: 0, left: 26, right: 26, height: 1, backgroundColor: "rgba(255,255,255,.26)" },
  profileDivider: { alignSelf: "stretch", height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.12)", marginTop: 16 },
  uploadBtn: { paddingVertical: 14, alignItems: "center", borderRadius: 16 },
  altBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(255,255,255,.05)" },
  kilitIkon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D" },
  throneGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 22, columnGap: 12 },
  betaNote: { flexDirection: "row", alignItems: "center", gap: 9, padding: 11, borderRadius: 12, backgroundColor: "rgba(245,206,110,.08)", borderWidth: 1, borderColor: `${C.gold}44`, marginBottom: 6 },
  betaIkon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1F", borderWidth: 1, borderColor: C.gold + "44" },
  kapsulGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  kapsulCell: { width: 104, alignItems: "center", gap: 3, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  bannerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  bannerCell: { alignItems: "center", padding: 6, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  tipRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  tipBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.03)" },
  idInput: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: `${C.gold}44`, backgroundColor: "rgba(0,0,0,.3)", paddingHorizontal: 16, color: "#fff", fontSize: 18, letterSpacing: 2, fontFamily: "PlusJakartaSans_800ExtraBold" },
});
