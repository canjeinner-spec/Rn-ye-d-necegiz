import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { type BadgeInfo } from "@/data/badgeInfo";
import { Gradient } from "@/theme/Gradient";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

// Liquid-glass rozet bilgi kartı — rozete tıklanınca ortada açılır.
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
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View entering={ZoomIn.springify().damping(16).mass(0.75)} style={styles.cardWrap}>
          <Pressable onPress={() => {}}>
            {/* cam gövde: blur + ince kenar ışığı + üstten tint parıltısı */}
            <BlurView intensity={60} tint="light" style={styles.card}>
              <Gradient
                colors={[info.tint + "38", "transparent"]}
                deg={180}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.sheen} pointerEvents="none" />

              <View style={[styles.glow, { backgroundColor: info.tint + "26", shadowColor: info.tint }]}>
                <Image source={source} style={styles.badge} contentFit="contain" />
              </View>

              <Txt weight="extrabold" size={22} color="#fff" align="center" style={{ marginTop: 16 }}>
                {info.title}
              </Txt>
              <View style={[styles.pill, { borderColor: info.tint + "66", backgroundColor: info.tint + "1F" }]}>
                <Txt weight="bold" size={11} color="#fff" style={{ letterSpacing: 0.5 }}>
                  {info.sub.toUpperCase()}
                </Txt>
              </View>
              <Txt size={13} color="rgba(255,255,255,.82)" lh={1.55} align="center" style={{ marginTop: 12 }}>
                {info.desc}
              </Txt>

              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Txt weight="bold" size={13} color="rgba(255,255,255,.9)">Kapat</Txt>
              </Pressable>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "rgba(3,3,8,.5)" },
  cardWrap: { width: "100%", maxWidth: 300 },
  card: {
    borderRadius: 26,
    overflow: "hidden",
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.22)",
    backgroundColor: "rgba(30,28,42,.55)",
  },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,.35)" },
  glow: {
    width: 132,
    height: 132,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    shadowOpacity: 0.9,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
  },
  badge: { width: 118, height: 118 },
  pill: { marginTop: 9, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  closeBtn: {
    marginTop: 18,
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
});
