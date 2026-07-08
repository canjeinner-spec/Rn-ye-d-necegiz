import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { type AccountBan } from "@/data/remote/authRepo";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Hesap yasaklıysa: kararan tam ekran arka plan + ORTADA aniden (ZoomIn)
 * açılan, kapatılamaz modal kart. Sebep + süre yazar; tek çıkış "Çıkış Yap".
 * Hem soğuk açılışta hem canlı ban anında bunu gösteririz.
 */
export function AccountBanBlock({ ban }: { ban: AccountBan }) {
  const router = useRouter();
  const clear = useApp((s) => s.clearHesapYasak);

  const ack = () => {
    clear();
    router.replace("/onboarding");
  };

  return (
    <View style={styles.root}>
      {/* Kararan arka plan — dokunmak kartı KAPATMAZ (yasak zorunlu). */}
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop} />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Animated.View entering={ZoomIn.springify().damping(15).mass(0.7)} style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="ban" size={34} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={20} color="#fff" align="center">Hesabın Askıya Alındı</Txt>
          <Txt size={12.5} color={C.dim} align="center" lh={1.55} style={{ marginTop: 7, paddingHorizontal: 4 }}>
            Bu hesap platform kurallarını ihlal ettiği için yönetim tarafından uygulamadan yasaklandı.
          </Txt>

          <View style={styles.info}>
            {!!ban.sebep && (
              <>
                <View style={styles.row}>
                  <Txt weight="bold" size={10} color={C.dim2} style={{ letterSpacing: 0.4 }}>SEBEP</Txt>
                  <Txt size={13} color={C.text} style={{ marginTop: 3 }} lh={1.5}>{ban.sebep}</Txt>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.row}>
              <Txt weight="bold" size={10} color={C.dim2} style={{ letterSpacing: 0.4 }}>SÜRE</Txt>
              <Txt weight="bold" size={13} color={ban.bitis ? C.text : "#FB7185"} style={{ marginTop: 3 }}>
                {ban.bitis ? `${tarih(ban.bitis)} tarihine kadar` : "Süresiz (kalıcı)"}
              </Txt>
            </View>
          </View>

          <Txt size={10.5} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 14, paddingHorizontal: 6 }}>
            Detaylar sistem mesajı olarak hesabına iletildi. Bir hata olduğunu düşünüyorsan destek ekibiyle iletişime geçebilirsin.
          </Txt>

          <Pressable onPress={ack} style={styles.btn}>
            <Icon name="power" size={15} color="#fff" />
            <Txt weight="extrabold" size={14} color="#fff">Çıkış Yap</Txt>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,3,7,0.9)" },
  safe: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26 },
  card: {
    width: "100%", maxWidth: 340, alignItems: "center", padding: 24, borderRadius: 26,
    backgroundColor: "#14121A", borderWidth: 1, borderColor: "rgba(251,113,133,.22)",
  },
  iconWrap: { width: 74, height: 74, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)", marginBottom: 16 },
  info: { alignSelf: "stretch", marginTop: 18, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { paddingVertical: 12, paddingHorizontal: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, alignSelf: "stretch", marginTop: 18, paddingVertical: 14, borderRadius: 15, backgroundColor: "#E11D48" },
});
