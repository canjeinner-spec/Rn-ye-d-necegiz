import { BlurView } from "expo-blur";
import { type LinearGradientProps } from "expo-linear-gradient";
import { Platform, StyleSheet, View } from "react-native";

import { Gradient } from "@/theme/Gradient";

/**
 * Cam yüzey zemini — blur + gradyan + (Android'de) telafi perdesi.
 *
 * SORUN: `expo-blur`ın `BlurView`ı iOS'te gerçek bir arka plan bulanıklığı
 * uyguluyor, Android'de ise pratikte hiçbir şey yapmıyor. Tasarım blur'un
 * getirdiği koyuluğa güvendiği için gradyanlar bilerek çok saydam seçilmiş
 * (ör. ProfileCard 0.30 → 0.42). iOS'te sonuç tam istenen his; Android'de
 * blur devreye girmeyince geriye yalnız o saydam gradyan kalıyor ve kart
 * "aşırı saydam" görünüyor. Kullanıcının bildirdiği fark tam olarak bu.
 *
 * ÇÖZÜM: Android'de blur'un yerine geçen ince bir perde katmanı. Gerçek
 * bulanıklık değil ama iki platformda AYNI okunabilirliği ve aynı koyuluğu
 * veriyor — istenen buydu.
 *
 * Neden `experimentalBlurMethod="dimezisBlurView"` değil: o gerçek blur
 * veriyor ama deneysel ve animasyonlu ekranlarda (oda sahnesi, sheet
 * açılışları) düşük seviye cihazlarda kare düşürüyor. Kesin ve ucuz olan
 * perde tercih edildi.
 */
export function CamZemin({
  intensity = 26,
  colors,
  deg = 170,
  locations,
  /** Android telafi perdesinin koyuluğu (0-1). Yüzey ne kadar saydamsa o kadar yüksek. */
  perde = 0.34,
}: {
  intensity?: number;
  colors: readonly [string, string, ...string[]];
  deg?: number;
  locations?: LinearGradientProps["locations"];
  perde?: number;
}) {
  return (
    <>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <Gradient colors={colors} deg={deg} locations={locations} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {Platform.OS === "android" && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(10,9,15,${perde})` }]}
        />
      )}
    </>
  );
}
