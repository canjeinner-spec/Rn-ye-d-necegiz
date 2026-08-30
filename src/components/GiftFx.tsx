import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { type Gift, type GiftTier, TIER_RING } from "@/data/gifts";
import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

type FxGift = Gift & { qty: number };

const KADEME_AD: Record<GiftTier, string> = {
  normal: "",
  rare: "NADİR",
  epic: "EPİK",
  legendary: "EFSANEVİ",
};

const CONF: Record<GiftTier, { size: number; parca: number; halka: number; etiket: boolean; dim: boolean }> = {
  normal: { size: 92, parca: 10, halka: 0, etiket: false, dim: false },
  rare: { size: 108, parca: 16, halka: 1, etiket: true, dim: false },
  epic: { size: 126, parca: 24, halka: 2, etiket: true, dim: false },
  legendary: { size: 148, parca: 34, halka: 3, etiket: true, dim: true },
};

/** Madalyondan dışa doğru açılan halka. */
function Halka({ gecikme, renk, size }: { gecikme: number; renk: string; size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(gecikme, withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false));
  }, [v, gecikme]);
  const stil = useAnimatedStyle(() => ({
    transform: [{ scale: 0.75 + v.value * 1.5 }],
    opacity: (1 - v.value) * 0.55,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: renk }, stil]}
    />
  );
}

/**
 * Kıvılcım — dev emoji yerine hediyenin renginde küçük ışık.
 *
 * Eskiden parçacıklar 14-38px'lik EMOJİ kopyalarıydı; ekran aynı emojiden
 * onlarcasıyla doluyordu, ucuz duruyordu.
 */
function Kivilcim({ i, adet, renkler }: { i: number; adet: number; renkler: string[] }) {
  const v = useSharedValue(0);
  const sol = (i * 37) % 100;
  const boy = 3 + (i % 3) * 1.6;
  const renk = renkler[i % renkler.length];
  const sure = 1500 + ((i * 137) % 900);

  useEffect(() => {
    v.value = withDelay((i % 8) * 90, withRepeat(withTiming(1, { duration: sure, easing: Easing.out(Easing.quad) }), -1, false));
  }, [v, i, sure]);

  const stil = useAnimatedStyle(() => ({
    transform: [
      { translateY: -170 * v.value },
      { translateX: Math.sin(v.value * Math.PI * 2 + i) * 14 },
      { scale: 1 - v.value * 0.55 },
    ],
    opacity: v.value < 0.15 ? v.value * 6 : 1 - v.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: `${sol}%`, top: "62%", width: boy, height: boy, borderRadius: boy / 2, backgroundColor: renk },
        stil,
      ]}
    />
  );
}

/**
 * Oda içi hediye efekti.
 *
 * Eski hâli: yarı saydam beyaz bir dairenin içinde dev emoji, etrafında aynı
 * emojinin uçuşan kopyaları, altında serbest yazı ve "✦ EFSANEVİ ✦" süsü.
 * Yeni hâli: hediyenin kendi renklerinden gradyan madalyon, dışa açılan
 * halkalar, renkli kıvılcımlar ve tek parça bir bilgi kapsülü.
 */
export function GiftFx({ gift }: { gift: FxGift }) {
  const tier = gift.tier || "normal";
  const ring = TIER_RING[tier];
  const conf = CONF[tier];
  const renkler = [gift.c1, gift.c2, "#FDE68A"];

  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 11, stiffness: 140, mass: 0.8 });
  }, [pop]);
  const popStil = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.55 + pop.value * 0.45 }],
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      {conf.dim && <Animated.View entering={FadeIn.duration(340)} exiting={FadeOut} style={styles.dim} />}

      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {Array.from({ length: conf.halka }, (_, i) => (
          <Halka key={i} gecikme={i * 480} renk={i % 2 ? gift.c2 : gift.c1} size={conf.size} />
        ))}

        <Animated.View style={[{ alignItems: "center", gap: 14 }, popStil]}>
          {/* Madalyon: dış gradyan halka + koyu iç zemin */}
          <View style={[styles.hale, { shadowColor: gift.c1, shadowRadius: conf.size * 0.32 }]}>
            <Gradient
              colors={[gift.c1, gift.c2, gift.c1]}
              deg={135}
              style={{ width: conf.size, height: conf.size, borderRadius: conf.size / 2, padding: 3 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: conf.size / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(10,9,14,.88)",
                }}
              >
                <Txt size={conf.size * 0.44}>{gift.emoji}</Txt>
              </View>
            </Gradient>
          </View>

          {conf.etiket && (
            <View style={[styles.kapsul, { borderColor: ring + "66" }]}>
              <Gradient colors={[gift.c1 + "3D", "rgba(10,9,14,.92)"]} deg={120} style={StyleSheet.absoluteFill} />
              {!!KADEME_AD[tier] && (
                <View style={[styles.kademe, { borderColor: ring + "66", backgroundColor: ring + "22" }]}>
                  <Txt weight="extrabold" size={8.5} color={ring} style={{ letterSpacing: 1 }}>{KADEME_AD[tier]}</Txt>
                </View>
              )}
              <Txt weight="displayBold" size={15} color="#fff" numberOfLines={1}>{gift.name}</Txt>
              <View style={[styles.adet, { borderColor: ring + "55" }]}>
                <Txt weight="extrabold" size={12} color={ring}>×{gift.qty}</Txt>
              </View>
            </View>
          )}
        </Animated.View>
      </View>

      {Array.from({ length: conf.parca }, (_, i) => (
        <Kivilcim key={i} i={i} adet={conf.parca} renkler={renkler} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 45 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,3,8,.6)" },
  hale: { shadowOpacity: 0.85, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
  kapsul: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    maxWidth: 300,
  },
  kademe: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  adet: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, backgroundColor: "rgba(255,255,255,.06)" },
});

