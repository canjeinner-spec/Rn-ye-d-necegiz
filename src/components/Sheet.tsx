import { type ReactNode, useEffect } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";
import { GlassPanel } from "@/theme/GlassPanel";

/**
 * Alt sayfa (bottom sheet) — SÜRÜKLEYİP KAPATILABİLİR.
 *
 * ── NEDEN @gorhom/bottom-sheet DEĞİL ──────────────────────────────────────
 *
 * Yol haritasında (1.7) "sheet'ler `BottomSheetModal`a geçsin" yazıyordu ve
 * paket zaten kurulu. Ama amaç kütüphane değiştirmek değil, SÜRÜKLEYİP
 * KAPATMA hissini kazanmaktı. Gorhom'a geçmek kök sağlayıcı eklemeyi, çocuk
 * API'sini, snap point'leri ve klavye davranışını baştan kurmayı gerektirir;
 * 11 çağrı yerinin hepsi yeniden yazılır ve `GlassPanel` + `KeyboardAware` +
 * güvenli alan düzeni yeniden doğrulanır. Kazanç aynı, risk katbekat fazla.
 *
 * Bu yüzden davranış BU BİLEŞENİN İÇİNE kondu: `Sheet`in dış API'si aynı
 * kaldı, 11 kullanım yerinin hiçbirine dokunulmadı, yerleşim değişmedi.
 * `react-native-gesture-handler` zaten kurulu ve `GestureHandlerRootView`
 * kökte duruyordu (`app/_layout.tsx`).
 *
 * ── SÜRÜKLEME YALNIZ TUTAMAÇTAN ───────────────────────────────────────────
 *
 * Hareket, sayfanın tamamına değil üstteki tutamaç alanına bağlı. Sebep:
 * sayfaların çoğunda içeride `ScrollView` var (hediye kutusu, kullanıcı
 * listesi, oda araçları). Gövdeye pan koymak kaydırmayla kavga eder ve
 * "bazen kayıyor bazen kapanıyor" gibi tahmin edilemez bir his verir.
 * Tutamaç alanı bilerek görünenden yüksek (22px): parmakla yakalanabilsin.
 */

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeightRatio?: number;
};

/** Bu kadar aşağı çekilirse kapanır. */
const KAPANMA_MESAFESI = 90;
/** Ya da bu hızda aşağı fırlatılırsa (px/sn) — kısa ama hızlı savurma. */
const KAPANMA_HIZI = 900;

export function Sheet({ visible, onClose, children, contentStyle, maxHeightRatio = 0.82 }: SheetProps) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);

  /**
   * Yeniden açılışta sıfırla. `Modal` kapalıyken çocuklarını çizmiyor ama
   * `Sheet`in kendisi (ve paylaşılan değer) mount kalıyor; sıfırlanmazsa
   * sayfa bir sonraki açılışta yarı sürüklenmiş görünür.
   */
  useEffect(() => {
    if (visible) y.value = 0;
  }, [visible, y]);

  const kapat = () => onClose();

  const surukle = Gesture.Pan()
    // Dikeyde 8px'i geçmeden etkinleşmiyor: dokunuşla sürüklemeyi ayırır.
    .activeOffsetY(8)
    .onUpdate((e) => {
      // Yalnız AŞAĞI. Yukarı çekmek sayfayı ekrandan taşırırdı.
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > KAPANMA_MESAFESI || e.velocityY > KAPANMA_HIZI) {
        runOnJS(kapat)();
        return;
      }
      y.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.7 });
    });

  const surukleStil = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAware behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Dış katman giriş/çıkış animasyonunu taşıyor, iç katman sürüklemeyi.
            İkisini aynı görünüme koymak `transform`u paylaştırıp çakışıyor. */}
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(200)}
          style={{ maxHeight: `${maxHeightRatio * 100}%` }}
        >
          <Animated.View style={surukleStil}>
            <Pressable>
              <GlassPanel sheet radius={28} style={[styles.box, { paddingBottom: 22 + insets.bottom }, contentStyle]}>
                <GestureDetector gesture={surukle}>
                  <Animated.View style={styles.tutamacAlani}>
                    <View style={styles.handle} />
                  </Animated.View>
                </GestureDetector>
                {children}
              </GlassPanel>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </KeyboardAware>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.6)" },
  // paddingTop 14 -> 6: tutamaç alanı kendi boşluğunu taşıyor, toplam yükseklik
  // eskisiyle neredeyse aynı kaldı (34 -> 36 px).
  box: { paddingHorizontal: 20, paddingTop: 6 },
  tutamacAlani: { paddingVertical: 9, alignItems: "center", marginBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.18)" },
});
