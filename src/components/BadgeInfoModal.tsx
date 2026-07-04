import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { type BadgeInfo } from "@/data/badgeInfo";
import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

// Liquid-glass rozet bilgi kartı — rozete tıklanınca aydınlanarak açılır,
// birkaç saniye sonra ya da herhangi bir dokunuşta kararak kapanır (buton yok).
const AUTO_MS = 3600;

export function BadgeInfoModal({
  visible,
  onClose,
  source,
  info,
}: {
  visible: boolean;
  onClose: () => void;
  source: number;
  info: BadgeInfo;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, AUTO_MS);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* herhangi bir dokunuş (kart dahil) direkt kapatır */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(260)} style={styles.cardWrap}>
          <BlurView intensity={22} tint="dark" style={styles.card}>
            <Gradient colors={[info.tint + "24", "transparent"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.sheen} pointerEvents="none" />

            <View style={[styles.glow, { backgroundColor: info.tint + "1F", shadowColor: info.tint }]}>
              <Image source={source} style={styles.badge} contentFit="contain" />
            </View>

            <Txt weight="extrabold" size={17} color="#fff" align="center" style={{ marginTop: 11 }}>{info.title}</Txt>
            <View style={[styles.pill, { borderColor: info.tint + "66", backgroundColor: info.tint + "22" }]}>
              <Txt weight="bold" size={10} color="#fff" style={{ letterSpacing: 0.5 }}>{info.sub.toUpperCase()}</Txt>
            </View>
            <Txt size={12} color="rgba(255,255,255,.9)" lh={1.5} align="center" style={{ marginTop: 9 }}>{info.desc}</Txt>
          </BlurView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "rgba(3,3,8,.28)" },
  cardWrap: { width: "100%", maxWidth: 230 },
  card: {
    borderRadius: 22,
    overflow: "hidden",
    paddingTop: 18,
    paddingBottom: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(16,14,22,.30)",
  },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  glow: {
    width: 92,
    height: 92,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  badge: { width: 80, height: 80 },
  pill: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
});
