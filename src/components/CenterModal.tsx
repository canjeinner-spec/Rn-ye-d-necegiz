import { type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

export function CenterModal({
  visible,
  onClose,
  children,
  dim = 0.62,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  dim?: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[styles.center, { backgroundColor: `rgba(3,3,8,${dim})` }]} onPress={onClose}>
          <Animated.View entering={ZoomIn.springify().damping(15).mass(0.7)} style={styles.wrap}>
            <Pressable>{children}</Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  wrap: { width: "100%", maxWidth: 320, alignItems: "stretch" },
});
