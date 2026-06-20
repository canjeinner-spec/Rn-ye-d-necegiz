import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { SlideInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { AuthorityTag } from "./AuthorityTag";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

type Item = { ic: IconName; label: string; sub: string; route: string };

const ITEMS: Item[] = [
  { ic: "trophy", label: "Sıralama", sub: "Zenginlik, cazibe, odalar", route: "/rank" },
  { ic: "cal", label: "Etkinlikler", sub: "Güncel etkinlikleri keşfet", route: "/events" },
  { ic: "users", label: "Arkadaşlarım", sub: "Arkadaş listen ve istekler", route: "/friends" },
  { ic: "eye", label: "Ziyaretçiler", sub: "Profilini kimler gezdi", route: "/visitors" },
  { ic: "idcard", label: "Özel ID", sub: "Prestijli kısa ID'ler", route: "/special-id" },
  { ic: "gear", label: "Hesap & Güvenlik", sub: "Hesabını yönet", route: "/security" },
  { ic: "chat", label: "Destek & SSS", sub: "Yardım al", route: "/support" },
];

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userName = useApp((s) => s.userName);
  const userPhoto = useApp((s) => s.userPhoto);
  const privileged = useApp((s) => s.role !== "user");

  if (!visible) return null;

  const go = (route: string) => {
    haptic.light();
    onClose();
    router.navigate(route as never);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInLeft.duration(240)} style={styles.panel}>
          <Pressable style={{ flex: 1 }} onPress={() => {}}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Gradient colors={["rgba(30,26,44,0.96)", "rgba(12,11,18,0.98)"]} deg={160} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={[styles.glint]} pointerEvents="none" />

            <View style={{ flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
              {/* Mini profil */}
              <Pressable onPress={() => go("/profile")} style={styles.profile}>
                <Portrait name="Sen" size={52} ring={C.gold} glow online photo={userPhoto || undefined} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1}>{userName}</Txt>
                    {privileged && <AuthorityTag size={8} />}
                  </View>
                  <Txt weight="semibold" size={10.5} color={C.gold2} style={{ marginTop: 3 }}>Profili Görüntüle →</Txt>
                </View>
              </Pressable>

              <View style={styles.divider} />

              <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
                {ITEMS.map((it) => (
                  <Pressable key={it.route} onPress={() => go(it.route)} style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Icon name={it.ic} size={17} color={C.gold2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={13} color={C.text}>{it.label}</Txt>
                      <Txt size={10} color={C.dim} style={{ marginTop: 1 }}>{it.sub}</Txt>
                    </View>
                    <Icon name="chev" size={14} color={C.dim2} />
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Icon name="x" size={15} color={C.dim} />
                <Txt weight="bold" size={12.5} color={C.dim}>Kapat</Txt>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(3,3,8,.55)" },
  panel: { width: "80%", maxWidth: 330, height: "100%", overflow: "hidden", borderTopRightRadius: 26, borderBottomRightRadius: 26, borderRightWidth: 1, borderColor: "rgba(255,255,255,.14)", backgroundColor: "rgba(16,14,22,0.6)" },
  glint: { position: "absolute", top: 40, bottom: 40, right: 0, width: 1, backgroundColor: "rgba(255,255,255,.35)" },
  profile: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 4 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,.08)", marginHorizontal: 16, marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 15, marginTop: 4 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,206,110,.12)", borderWidth: 1, borderColor: "rgba(245,206,110,.22)" },
  closeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginHorizontal: 18, marginTop: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
});
