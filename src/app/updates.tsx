import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Status = "gelistiriliyor" | "yakinda" | "planlaniyor";
const ST: Record<Status, { t: string; c: string }> = {
  gelistiriliyor: { t: "Geliştiriliyor", c: C.teal },
  yakinda: { t: "Yakında", c: C.gold2 },
  planlaniyor: { t: "Planlanıyor", c: C.purple2 },
};

const ROADMAP: { ic: IconName; t: string; s: string; st: Status }[] = [
  { ic: "gift", t: "Hediye & Ekonomi", s: "Hediye gönderme, elmas ve coin ekonomisi", st: "yakinda" },
  { ic: "userAdd", t: "Arkadaş Sistemi", s: "Arkadaş ekle, istekler ve arkadaş listesi", st: "yakinda" },
  { ic: "mega", t: "Etkinlikler", s: "Kampanyalar, yarışmalar ve ödüller", st: "yakinda" },
  { ic: "bell", t: "Bildirimler", s: "Mesaj, davet ve etkileşim bildirimleri", st: "gelistiriliyor" },
  { ic: "evDiamond", t: "Envanter (Eşyalarım)", s: "Çerçeve, balon ve sahip olduğun eşyalar", st: "planlaniyor" },
  { ic: "mic", t: "Yayıncı Merkezi", s: "Kazanç, ajans ve yayıncı paneli", st: "yakinda" },
  { ic: "crown", t: "VIP Ayrıcalıkları", s: "Özel çerçeveler, rozetler ve temalar", st: "planlaniyor" },
  { ic: "gear", t: "Performans & Stabilite", s: "Daha akıcı, daha hızlı bir deneyim", st: "gelistiriliyor" },
];

export default function UpdatesScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Gradient colors={["#0E2A2A", "#0A0F14"]} deg={180} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color="#fff" />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Gelecek Güncelleme</Txt>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Hero görsel — tam tasarım */}
          <Image source={require("../../assets/images/update-banner.png")} style={styles.heroImg} contentFit="cover" />
          <Txt size={12} color="rgba(255,255,255,.78)" align="center" lh={1.6} style={{ marginTop: 14, paddingHorizontal: 6 }}>
            Aron Chat her gün biraz daha iyi oluyor. Şu an üzerinde çalıştığımız ve sırada bekleyen özellikler:
          </Txt>

          {/* Yol haritası */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>YOL HARİTASI</Txt>
          {ROADMAP.map((r) => {
            const st = ST[r.st];
            return (
              <View key={r.t} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: st.c + "1A", borderColor: st.c + "44" }]}>
                  <Icon name={r.ic} size={18} color={st.c} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={13.5} color={C.text}>{r.t}</Txt>
                  <Txt size={11} color={C.dim} lh={1.45} style={{ marginTop: 2 }}>{r.s}</Txt>
                </View>
                <View style={[styles.stPill, { backgroundColor: st.c + "1A", borderColor: st.c + "55" }]}>
                  <View style={[styles.stDot, { backgroundColor: st.c }]} />
                  <Txt weight="extrabold" size={9} color={st.c}>{st.t}</Txt>
                </View>
              </View>
            );
          })}

          <Txt size={11} color={C.dim} align="center" lh={1.6} style={{ marginTop: 20, paddingHorizontal: 10 }}>
            Bir fikrin mi var? Geri bildirimlerin yol haritamızı şekillendiriyor.
          </Txt>
          <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Aron Chat · 2026</Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F14" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.3)", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  heroImg: { width: "100%", aspectRatio: 1731 / 909, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  sectionLbl: { letterSpacing: 0.5, marginTop: 26, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  stPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  stDot: { width: 5, height: 5, borderRadius: 2.5 },
});
