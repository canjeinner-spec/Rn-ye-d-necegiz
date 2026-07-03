import { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAware } from "@/components/KeyboardAware";
import { GlassPanel } from "@/theme/GlassPanel";

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeightRatio?: number;
};

export function Sheet({ visible, onClose, children, contentStyle, maxHeightRatio = 0.82 }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAware behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.duration(280)} exiting={SlideOutDown.duration(200)} style={{ maxHeight: `${maxHeightRatio * 100}%` }}>
          <Pressable>
            <GlassPanel sheet radius={28} style={[styles.box, { paddingBottom: 22 + insets.bottom }, contentStyle]}>
              <View style={styles.handle} />
              {children}
            </GlassPanel>
          </Pressable>
        </Animated.View>
      </KeyboardAware>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3,3,8,.6)" },
  box: { paddingHorizontal: 20, paddingTop: 14 },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.18)", alignSelf: "center", marginBottom: 16 },
});
