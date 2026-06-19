import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { C } from "@/theme/colors";
import { GlassPanel } from "@/theme/GlassPanel";
import { Gradient } from "@/theme/Gradient";

/**
 * Geçici açılış ekranı — temel katmanı (font + gradient + cam panel) doğrular.
 * Navigasyon iskeleti (Aşama 2) kurulunca asıl ekranlarla değiştirilecek.
 */
export default function Index() {
  return (
    <View style={styles.root}>
      <Gradient colors={["#17121F", "#050507"]} deg={180} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Txt weight="displayBold" size={40} color={C.gold} style={styles.brand}>
            ARON
          </Txt>
          <Txt weight="semibold" size={13} color={C.dim} style={{ letterSpacing: 4 }}>
            CHAT
          </Txt>

          <GlassPanel style={styles.panel} radius={20}>
            <Txt weight="bold" size={15} color={C.text}>
              Temel katman hazır
            </Txt>
            <Txt weight="medium" size={12} color={C.dim} style={{ marginTop: 6 }}>
              Tema · font · gradient · cam panel
            </Txt>
          </GlassPanel>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  brand: { letterSpacing: 2 },
  panel: { marginTop: 36, paddingVertical: 22, paddingHorizontal: 28, alignItems: "center" },
});
