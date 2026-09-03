import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AronMark } from "@/components/AronMark";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

/** Ekip bilgisi — gerçek sayıyı buradan güncelleyebilirsin. */
const TEAM_SIZE = 3;

const STATS: { ic: IconName; v: string; l: string }[] = [
  { ic: "users", v: `${TEAM_SIZE} kişi`, l: "Bağımsız ekip" },
  { ic: "evMoon", v: "Sayısız gece", l: "Emek & özen" },
  { ic: "evStar", v: "Tek hedef", l: "Kalite" },
];

const VALUES: { ic: IconName; c: string; t: string; s: string }[] = [
  { ic: "shield", c: C.teal, t: "Güven", s: "Verilerin ve gizliliğin bizim için pazarlık konusu değil." },
  { ic: "heart", c: "#FB7185", t: "Topluluk", s: "Her güncelleme, sizin geri bildirimlerinizle şekilleniyor." },
  { ic: "crown", c: C.gold2, t: "Kalite", s: "Hızlı, akıcı ve şık bir deneyim için detaylara takılıyoruz." },
];

export default function AboutScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color="#fff" />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Biz Kimiz?</Txt>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <Gradient colors={["rgba(124,58,237,.18)", "rgba(245,206,110,.05)"]} deg={150} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <AronMark s={84} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
              <Txt weight="displayBold" size={22} color="#fff" style={{ letterSpacing: 2 }}>ARON</Txt>
              <Txt weight="displayBold" size={22} color={C.gold} style={{ letterSpacing: 2 }}>CHAT</Txt>
            </View>
            <Txt weight="semibold" size={12} color={C.gold2} style={{ marginTop: 6 }}>Tutkuyla yapıldı, özenle büyüyor.</Txt>
          </View>

          {/* Giriş */}
          <Txt size={13.5} color="rgba(255,255,255,.86)" lh={1.7} style={{ marginTop: 22 }}>
            Aron Chat'i büyük bütçeli bir şirket değil; her satırına, her ekranına emek veren{" "}
            <Txt weight="extrabold" size={13.5} color="#fff">küçük ve bağımsız bir ekip</Txt> kuruyor.
            Amacımız net: sesli sohbetin en akıcı, en şık ve en güvenilir halini sunmak.
          </Txt>

          {/* İstatistikler */}
          <View style={styles.statRow}>
            {STATS.map((s) => (
              <View key={s.l} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Icon name={s.ic} size={18} color={C.gold2} />
                </View>
                <Txt weight="displayBold" size={14} color="#fff" align="center" style={{ marginTop: 8 }}>{s.v}</Txt>
                <Txt weight="semibold" size={9.5} color={C.dim} align="center" style={{ marginTop: 2 }}>{s.l}</Txt>
              </View>
            ))}
          </View>

          {/* Değerler */}
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>NEYE İNANIYORUZ</Txt>
          {VALUES.map((v) => (
            <View key={v.t} style={styles.valueRow}>
              <View style={[styles.valueIcon, { backgroundColor: v.c + "1A", borderColor: v.c + "44" }]}>
                <Icon name={v.ic} size={18} color={v.c} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={13.5} color={C.text}>{v.t}</Txt>
                <Txt size={11.5} color={C.dim} lh={1.5} style={{ marginTop: 2 }}>{v.s}</Txt>
              </View>
            </View>
          ))}

          {/* Yolculuk */}
          <View style={styles.journeyCard}>
            <Txt weight="displayBold" size={14} color="#fff">Daha yeni başlıyoruz</Txt>
            <Txt size={12} color="rgba(255,255,255,.78)" lh={1.65} style={{ marginTop: 8 }}>
              Gördüğün her şey, kısıtlı imkânlarla ama büyük bir hevesle yapıldı. Bu yolculuğun bir parçası
              olduğun için teşekkürler — en iyi kısmı henüz önümüzde.
            </Txt>
          </View>

          <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 22 }}>Aron Chat · 2026</Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.3)", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingVertical: 26, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: C.kart },
  statRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,206,110,.12)", borderWidth: 1, borderColor: "rgba(245,206,110,.22)" },
  sectionLbl: { letterSpacing: 0.5, marginTop: 26, marginBottom: 12 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderRadius: 16, backgroundColor: C.kart, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  valueIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  journeyCard: { marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: `${C.gold}33`, backgroundColor: `${C.gold}0E` },
});
