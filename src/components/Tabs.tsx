import { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Touch } from "./Touch";
import { Txt } from "./Txt";

/**
 * Üst sekme şeridi — aktif sekmenin altında altın çizgi.
 *
 * Çizgi artık sekmeler arasında KAYIYOR (eskiden anında yer değiştiriyordu).
 *
 * `fill` modu: sekmeler eşit genişlikte yayılır ve çizgi ortalanmış kısa bir
 * bar olur. Cüzdan ve Görevler ekranlarında iki tane dolu gradyan buton
 * vardı; sekme mi aksiyon mu belli olmuyordu, onların yerine bu kullanılıyor.
 */
type TabsProps = {
  items: string[];
  active: number;
  set: (i: number) => void;
  pad?: number;
  /** Sekmeler eşit genişlikte yayılsın (2-3 sekmelik ekranlar için) */
  fill?: boolean;
};

const BAR = 34; // fill modunda ortalanmış çizginin genişliği

export function Tabs({ items, active, set, pad = 18, fill = false }: TabsProps) {
  // Her sekmenin ölçüsü — çizgi buna göre konumlanır.
  const [olcum, setOlcum] = useState<{ x: number; w: number }[]>([]);
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  const olc = (i: number) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setOlcum((p) => {
      if (p[i] && p[i].x === lx && p[i].w === width) return p;
      const n = [...p];
      n[i] = { x: lx, w: width };
      return n;
    });
  };

  useEffect(() => {
    const m = olcum[active];
    if (!m) return;
    const hedefW = fill ? BAR : m.w;
    const hedefX = fill ? m.x + (m.w - BAR) / 2 : m.x;
    // İlk yerleşimde animasyon yok, sonrasında kayarak geçiş.
    if (w.value === 0) { x.value = hedefX; w.value = hedefW; return; }
    const cfg = { duration: 220, easing: Easing.out(Easing.cubic) };
    x.value = withTiming(hedefX, cfg);
    w.value = withTiming(hedefW, cfg);
  }, [active, olcum, fill, x, w]);

  const cizgiStil = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));

  return (
    <View style={[styles.wrap, { paddingHorizontal: pad, gap: fill ? 0 : 22 }]}>
      {items.map((t, i) => (
        <Touch
          key={t}
          onLayout={olc(i)}
          onPress={() => { if (i !== active) { haptic.select(); set(i); } }}
          style={fill ? styles.tabFill : styles.tab}
          // Sekmede küçülme YOK: alt çizgi `onLayout` ölçümüne bağlı ve
          // sekmelerin zıpladığı his native değil. Sönme + dalga yeterli.
          kucul={false}
        >
          {/* Pasif sekmeler de biraz kalın: "semibold" fazla siliktı,
              "bold" seçili olanla yarışmadan okunur kalıyor. */}
          <Txt weight={i === active ? "extrabold" : "bold"} size={fill ? 13 : 13} color={i === active ? C.gold : C.dim}>
            {t}
          </Txt>
        </Touch>
      ))}

      {olcum[active] && <Animated.View style={[styles.cizgi, cizgiStil]} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", paddingTop: 2, borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { paddingTop: 8, paddingBottom: 9 },
  tabFill: { flex: 1, alignItems: "center", paddingTop: 10, paddingBottom: 11 },
  cizgi: { position: "absolute", bottom: -1, left: 0, height: 2.5, borderRadius: 4, backgroundColor: C.gold },
});
