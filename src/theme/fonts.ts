import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora";

/**
 * Web mockup fontları:
 *   body  → Plus Jakarta Sans (500/600/700/800)
 *   display → Sora (700/800)
 * useFonts(fontMap) ile yüklenir.
 */
export const fontMap = {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  Sora_700Bold,
  Sora_800ExtraBold,
};

/** Font-family adları — weight'e göre StyleSheet'te kullanılır. */
export const Font = {
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
  display: "Sora_700Bold",
  displayBold: "Sora_800ExtraBold",
} as const;
