import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AronMark } from "@/components/AronMark";
import { Txt } from "@/components/Txt";
import { Yukleniyor } from "@/components/Yukleniyor";
import { getBanner, type Banner, type BannerSablon } from "@/data/remote/announceRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Her şablonun görsel kimliği — gradyan, aksan rengi, emblem ikonu, varsayılan rozet. */
const TEMA: Record<BannerSablon, { g: [string, string]; bg: string; accent: string; ic: IconName; rozet: string; footIc: IconName }> = {
  duyuru:   { g: ["#241B3A", "#0B0712"], bg: "#0B0712", accent: "#F5CE6E", ic: "mega", rozet: "DUYURU", footIc: "mega" },
  bakim:    { g: ["#2A1E0A", "#0A0705"], bg: "#0A0705", accent: "#F59E0B", ic: "gear", rozet: "PLANLI BAKIM", footIc: "gear" },
  etkinlik: { g: ["#0E2A2A", "#0A0F14"], bg: "#0A0F14", accent: "#5EEAD4", ic: "gift", rozet: "ETKİNLİK", footIc: "gift" },
};

export default function BannerDetay() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const bid = Number(id);
    if (!isSupabaseConfigured || !Number.isFinite(bid)) { setLoading(false); return; }
    getBanner(bid).then((b) => { if (alive) { setBanner(b); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const t = TEMA[banner?.sablon ?? "duyuru"];
  const ic = banner?.icerik ?? {};
  const rozet = (ic.rozet || t.rozet).toUpperCase();
  const maddeler = ic.maddeler ?? [];

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Gradient colors={t.g} deg={180} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color="#fff" />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1} style={{ flex: 1 }}>
            {banner?.baslik ?? "Duyuru"}
          </Txt>
        </View>

        {loading ? (
          <Yukleniyor tamEkran />
        ) : !banner ? (
          <View style={styles.center}>
            <Icon name="mega" size={26} color={C.dim2} />
            <Txt size={13} color={C.dim} style={{ marginTop: 12 }}>Bu duyuru artık mevcut değil.</Txt>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            {banner.foto ? (
              <View style={styles.heroImgWrap}>
                <Image source={{ uri: banner.foto }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} />
                <Gradient colors={["rgba(8,8,12,.05)", "rgba(8,8,12,.8)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.heroImgText}>
                  <View style={[styles.rozet, { backgroundColor: t.accent }]}>
                    <Txt weight="extrabold" size={8.5} color="#0B1014" style={{ letterSpacing: 1 }}>{rozet}</Txt>
                  </View>
                  <Txt weight="displayBold" size={22} color="#fff" style={{ marginTop: 9 }}>{banner.baslik}</Txt>
                  {!!ic.altBaslik && <Txt weight="semibold" size={12.5} color="rgba(255,255,255,.85)" style={{ marginTop: 4 }}>{ic.altBaslik}</Txt>}
                </View>
              </View>
            ) : (
              <View style={styles.hero}>
                <Gradient colors={[t.accent + "22", "rgba(255,255,255,.02)"]} deg={150} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={[styles.emblem, { borderColor: t.accent + "44" }]}>
                  <Gradient colors={[t.accent, t.accent + "55"]} deg={150} style={StyleSheet.absoluteFill} />
                  {banner.sablon === "duyuru" ? <AronMark s={54} /> : <Icon name={t.ic} size={34} color="#0B0705" />}
                </View>
                <View style={[styles.rozet, { backgroundColor: t.accent, marginTop: 16 }]}>
                  <Txt weight="extrabold" size={8.5} color="#0B1014" style={{ letterSpacing: 1 }}>{rozet}</Txt>
                </View>
                <Txt weight="displayBold" size={22} color="#fff" align="center" style={{ marginTop: 12 }}>{banner.baslik}</Txt>
                {!!ic.altBaslik && <Txt weight="semibold" size={12.5} color={t.accent} align="center" style={{ marginTop: 6 }}>{ic.altBaslik}</Txt>}
              </View>
            )}

            {/* Giriş metni */}
            {!!ic.giris && (
              <Txt size={13.5} color="rgba(255,255,255,.86)" lh={1.7} style={{ marginTop: 22 }}>{ic.giris}</Txt>
            )}

            {/* Maddeler (bölüm satırları) */}
            {maddeler.length > 0 && (
              <>
                <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>
                  {banner.sablon === "bakim" ? "NELER OLACAK" : banner.sablon === "etkinlik" ? "DETAYLAR" : "AYRINTILAR"}
                </Txt>
                {maddeler.map((m, i) => (
                  <View key={i} style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: t.accent + "1A", borderColor: t.accent + "44" }]}>
                      <Txt weight="displayBold" size={13} color={t.accent}>{i + 1}</Txt>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={13.5} color={C.text}>{m.baslik}</Txt>
                      {!!m.aciklama && <Txt size={11.5} color={C.dim} lh={1.5} style={{ marginTop: 2 }}>{m.aciklama}</Txt>}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Kapanış */}
            {!!ic.kapanis && (
              <View style={[styles.closeCard, { borderColor: t.accent + "33", backgroundColor: t.accent + "0E" }]}>
                <Txt size={12.5} color="rgba(255,255,255,.82)" lh={1.65}>{ic.kapanis}</Txt>
              </View>
            )}

            {/* açıklama yalnızca banner önizleme metniyse, içerik boşsa göster */}
            {!ic.giris && !maddeler.length && !ic.kapanis && !!banner.aciklama && (
              <Txt size={13.5} color="rgba(255,255,255,.86)" lh={1.7} style={{ marginTop: 22 }}>{banner.aciklama}</Txt>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 26 }}>
              <Icon name={t.footIc} size={12} color={C.dim2} />
              <Txt size={10.5} color={C.dim2} align="center">Aron Chat · 2026</Txt>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.3)", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  hero: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 20, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: C.kart },
  emblem: { width: 76, height: 76, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroImgWrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", justifyContent: "flex-end" },
  heroImgText: { padding: 16 },
  rozet: { alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 7 },
  sectionLbl: { letterSpacing: 0.5, marginTop: 26, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderRadius: 16, backgroundColor: C.kart, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  closeCard: { marginTop: 18, padding: 16, borderRadius: 18, borderWidth: 1 },
});
