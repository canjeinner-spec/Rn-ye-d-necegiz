import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { OzelIdGosterim } from "@/components/OzelId";
import { Gradient } from "@/theme/Gradient";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

// Liquid-glass ÖZEL ID bilgi kartı — profildeki ID'ye tıklanınca açılır.
export function OzelIdInfoModal({
  visible,
  onClose,
  onEdit,
  id,
  tip,
  tema,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  id: string;
  tip: "premium" | "kapsul";
  tema: string;
}) {
  const premium = tip === "premium";
  const baslik = premium ? "Premium Özel ID" : "Kapsül Özel ID";
  const aciklama = premium
    ? "Sana özel tanımlı premium kimlik. Kısa ID'ler (≤5 hane) nadir ve prestijlidir; çerçevenin üzerine kabartma ID'nle taşınır."
    : "Kapsül kimliğin. 6–7 haneli özel ID'n, temanın rengiyle uyumlu kapsülde gösterilir.";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View entering={ZoomIn.springify().damping(16).mass(0.75)} style={styles.cardWrap}>
          <Pressable onPress={() => {}}>
            <BlurView intensity={60} tint="light" style={styles.card}>
              <Gradient colors={[`${C.gold}30`, "transparent"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={styles.sheen} pointerEvents="none" />

              <View style={{ marginTop: 6, marginBottom: 4 }}>
                <OzelIdGosterim id={id} tip={tip} tema={tema} premiumWidth={244} kapsulSize={18} />
              </View>

              <Txt weight="extrabold" size={20} color="#fff" align="center" style={{ marginTop: 14 }}>{baslik}</Txt>
              <View style={[styles.pill, { borderColor: `${C.gold}66`, backgroundColor: `${C.gold}1F` }]}>
                <Txt weight="bold" size={11} color={C.gold2} style={{ letterSpacing: 1 }}>ID · {id}</Txt>
              </View>
              <Txt size={13} color="rgba(255,255,255,.82)" lh={1.55} align="center" style={{ marginTop: 12 }}>{aciklama}</Txt>

              <Pressable onPress={onEdit} style={styles.editBtn}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.editInner}>
                  <Txt weight="displayBold" size={13} color="#3A2A05">Özel ID Sayfası</Txt>
                </Gradient>
              </Pressable>
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
  cardWrap: { width: "100%", maxWidth: 320 },
  card: { borderRadius: 26, overflow: "hidden", paddingTop: 24, paddingBottom: 16, paddingHorizontal: 20, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.22)", backgroundColor: "rgba(30,28,42,.55)" },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,.35)" },
  pill: { marginTop: 9, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  editBtn: { marginTop: 18, alignSelf: "stretch", borderRadius: 14, overflow: "hidden" },
  editInner: { paddingVertical: 12, alignItems: "center" },
  closeBtn: { marginTop: 10, alignSelf: "stretch", alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,.1)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
});
