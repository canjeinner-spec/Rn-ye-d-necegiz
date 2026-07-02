import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { type AccountBan } from "@/data/remote/authRepo";
import { Icon } from "@/icons/Icon";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function tarih(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Hesap yasaklıysa uygulamanın tamamını kapatan, kapatılamaz tam ekran engel. */
export function AccountBanBlock({ ban }: { ban: AccountBan }) {
  const router = useRouter();
  const clear = useApp((s) => s.clearHesapYasak);

  const ack = () => {
    clear();
    router.replace("/onboarding");
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#2A0E12", "#08080C"]} deg={165} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Icon name="ban" size={40} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={22} color="#fff" align="center">Hesabın Askıya Alındı</Txt>
          <Txt size={13} color={C.dim} align="center" lh={1.6} style={{ marginTop: 8, paddingHorizontal: 8 }}>
            Bu hesap platform kurallarını ihlal ettiği için yönetim tarafından uygulamadan yasaklandı.
          </Txt>

          <View style={styles.card}>
            {!!ban.sebep && (
              <>
                <View style={styles.row}>
                  <Txt weight="bold" size={10.5} color={C.dim2}>SEBEP</Txt>
                  <Txt size={13} color={C.text} style={{ marginTop: 3 }} lh={1.5}>{ban.sebep}</Txt>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.row}>
              <Txt weight="bold" size={10.5} color={C.dim2}>SÜRE</Txt>
              <Txt weight="bold" size={13} color={ban.bitis ? C.text : "#FB7185"} style={{ marginTop: 3 }}>
                {ban.bitis ? `${tarih(ban.bitis)} tarihine kadar` : "Süresiz (kalıcı)"}
              </Txt>
            </View>
          </View>

          <Txt size={11} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 18, paddingHorizontal: 12 }}>
            Bir hata olduğunu düşünüyorsan destek ekibiyle iletişime geçebilirsin.
          </Txt>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={ack} style={styles.btn}>
            <Icon name="power" size={15} color="#fff" />
            <Txt weight="extrabold" size={14} color="#fff">Çıkış Yap</Txt>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: C.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  iconWrap: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)", marginBottom: 22 },
  card: { alignSelf: "stretch", marginTop: 22, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { paddingVertical: 13, paddingHorizontal: 15 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  footer: { paddingHorizontal: 22, paddingBottom: 8 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 15, borderRadius: 16, backgroundColor: "#E11D48" },
});
