import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { TIER_RING } from "@/data/gifts";
import { Icon } from "@/icons/Icon";
import { type BroadcastData } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

/** Şeridin ekranda kalma süresi. */
const KALMA_MS = 4200;

/**
 * Büyük hediye yayını — tüm uygulamada görünen duyuru.
 *
 * Eskiden ekranın en tepesinde (durum çubuğunun dibinde), koyu yeşilimsi bir
 * kapsül içinde 16 saniye boyunca sağdan sola KAYIYORDU. Okumak için şeridi
 * takip etmek gerekiyordu, cümle altı ayrı parçaya bölünmüştü ("X kullanıcısı
 * Y kişisine 🎁 Z ×3 gönderdi!") ve hediye ham emoji olarak çiziliyordu.
 *
 * Artık: sağdan yayla girer, YERİNDE DURUR, okunur, sonra sağa süzülüp
 * kaybolur. İki satır: kimden→kime, altında hediye ve adet. Renkler hediyenin
 * kademesinden gelir (efsane altın, epik mor, nadir mavi).
 */
export function GlobalBroadcast({ data, onGo, top = 52 }: { data: BroadcastData; onGo: () => void; top?: number }) {
  const ring = TIER_RING[data.gift.tier] || C.gold;
  const efsane = data.gift.tier === "legendary";

  const x = useSharedValue(420);
  const o = useSharedValue(0);

  useEffect(() => {
    o.value = withTiming(1, { duration: 220 });
    x.value = withSpring(0, { damping: 16, stiffness: 130, mass: 0.9 });

    const cik = setTimeout(() => {
      x.value = withTiming(420, { duration: 420, easing: Easing.in(Easing.cubic) });
      o.value = withDelay(160, withTiming(0, { duration: 260 }));
    }, KALMA_MS);
    return () => clearTimeout(cik);
  }, [x, o]);

  const stil = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: o.value }));

  return (
    <View style={[styles.serit, { top }]} pointerEvents="box-none">
      <Animated.View style={stil}>
        <Pressable onPress={onGo} style={[styles.hap, { borderColor: ring + (efsane ? "80" : "55") }]}>
          {/* Zemin: hediyenin kendi renkleri, çok düşük yoğunlukta */}
          <Gradient colors={[ring + "2E", "rgba(12,11,16,.94)"]} deg={110} style={StyleSheet.absoluteFill} />

          <View style={{ width: 34, height: 34 }}>
            <Portrait name={data.sender} size={34} ring={ring} glow />
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Txt weight="extrabold" size={11.5} color={ring} numberOfLines={1} style={{ flexShrink: 1 }}>
                {data.sender}
              </Txt>
              <Icon name="chev" size={11} sw={2.4} color={C.dim2} />
              <Txt weight="extrabold" size={11.5} color={C.gold2} numberOfLines={1} style={{ flexShrink: 1 }}>
                {data.recipient || "Herkese"}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={[styles.hediyeIkon, { borderColor: ring + "4D", backgroundColor: ring + "1A" }]}>
                <Txt size={11}>{data.gift.emoji}</Txt>
              </View>
              <Txt weight="bold" size={10.5} color="rgba(255,255,255,.82)" numberOfLines={1} style={{ flexShrink: 1 }}>
                {data.gift.name}
              </Txt>
              <View style={[styles.adet, { borderColor: ring + "55", backgroundColor: ring + "1F" }]}>
                <Txt weight="extrabold" size={9.5} color={ring}>×{data.qty}</Txt>
              </View>
            </View>
          </View>

          <View style={styles.git}>
            <Txt weight="extrabold" size={10.5} color="#241A05">Git</Txt>
            <Icon name="chev" size={11} sw={2.6} color="#241A05" />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  serit: { position: "absolute", left: 12, right: 12, zIndex: 55 },
  hap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 7,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
  hediyeIkon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  adet: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  git: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, backgroundColor: C.gold2 },
});
