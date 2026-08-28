import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Hub = { ic: IconName; c: string; t: string; s: string; route: string };
const HUBS: Hub[] = [
  { ic: "mega", c: C.gold2, t: "Herkese Duyuru", s: "Tüm kullanıcılara resmî duyuru / sistem mesajı", route: "/admin-broadcast" },
  { ic: "user", c: C.teal, t: "Kişiye Mesaj / Uyarı", s: "Tek bir kullanıcıya özel mesaj ya da resmî uyarı", route: "/admin-mesaj?tip=kisi" },
  { ic: "users", c: C.purple2, t: "Odaya Mesaj / Uyarı", s: "Bir odaya; sahibe iletilir, içeridekiler canlı görür", route: "/admin-mesaj?tip=oda" },
  { ic: "ticket", c: "#F59E0B", t: "Banner Yönetimi", s: "Oda listesi üstü banner'ları ekle / düzenle / sil", route: "/admin-banner" },
];

export default function AdminDuyuru() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="mega" size={17} color={C.gold} />
            <Txt weight="displayBold" size={16} color="#fff">Duyuru & Mesaj</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Txt size={12} color={C.dim} lh={1.5} style={{ marginBottom: 14 }}>
            Kime ulaşmak istediğini seç. Her biri ayrı, sade bir sayfada açılır.
          </Txt>
          {HUBS.map((h) => (
            <Pressable key={h.route} onPress={() => { haptic.light(); router.navigate(h.route as never); }} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: h.c + "1A", borderColor: h.c + "44" }]}>
                <Icon name={h.ic} size={19} color={h.c} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={14} color={C.text}>{h.t}</Txt>
                <Txt size={11} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{h.s}</Txt>
              </View>
              <Icon name="chev" size={16} color={C.dim2} />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", marginBottom: 11 },
  rowIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
