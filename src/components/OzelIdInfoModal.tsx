import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { OzelIdGosterim } from "@/components/OzelId";
import { Gradient } from "@/theme/Gradient";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

// Liquid-glass ÖZEL ID bilgi penceresi — aydınlanarak açılır, birkaç saniye
// sonra ya da herhangi bir dokunuşta kararak kapanır (buton yok).
const AUTO_MS = 3600;

export function OzelIdInfoModal({
  visible,
  onClose,
  id,
  tip,
  tema,
}: {
  visible: boolean;
  onClose: () => void;
  id: string;
  tip: "premium" | "kapsul";
  tema: string;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, AUTO_MS);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  const premium = tip === "premium";
  const baslik = premium ? "Premium Özel ID" : "Kapsül Özel ID";
  const aciklama = premium
    ? "Sana özel premium kimlik. Kısa ID'ler nadir ve prestijlidir."
    : "Kapsül kimliğin — 6–7 haneli özel ID'n temanın rengiyle gösterilir.";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(260)} style={styles.cardWrap}>
          <BlurView intensity={22} tint="dark" style={styles.card}>
            <Gradient colors={[`${C.gold}20`, "transparent"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.sheen} pointerEvents="none" />

            <View style={{ marginTop: 2 }}>
              <OzelIdGosterim id={id} tip={tip} tema={tema} premiumWidth={196} kapsulSize={15} />
            </View>

            <Txt weight="extrabold" size={16} color="#fff" align="center" style={{ marginTop: 11 }}>{baslik}</Txt>
            <View style={[styles.pill, { borderColor: `${C.gold}66`, backgroundColor: `${C.gold}22` }]}>
              <Txt weight="bold" size={10} color={C.gold2} style={{ letterSpacing: 1 }}>ID · {id}</Txt>
            </View>
            <Txt size={12} color="rgba(255,255,255,.9)" lh={1.5} align="center" style={{ marginTop: 9 }}>{aciklama}</Txt>
          </BlurView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "rgba(3,3,8,.28)" },
  cardWrap: { width: "100%", maxWidth: 246 },
  card: {
    borderRadius: 22,
    overflow: "hidden",
    paddingTop: 16,
    paddingBottom: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(16,14,22,.30)",
  },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  pill: { marginTop: 8, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
});
