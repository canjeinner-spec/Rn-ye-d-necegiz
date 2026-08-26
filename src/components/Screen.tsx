import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { C } from "@/theme/colors";

/**
 * Sayfa kabı — WePlay dili: gri sayfa zemini, içerik beyaz bloklar hâlinde.
 * Her ekran bununla sarılır; zemin rengi tek yerden gelir.
 */
export function Screen({
  children,
  edges = ["top", "bottom"],
  bg = C.bg,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  bg?: string;
}) {
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
