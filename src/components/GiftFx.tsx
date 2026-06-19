import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { type Gift, type GiftTier, TIER_RING } from "@/data/gifts";
import { Txt } from "./Txt";

type FxGift = Gift & { qty: number };

const CONF: Record<GiftTier, { size: number; particles: number; glow: number; ringWave: boolean; label: boolean; dim: boolean }> = {
  normal: { size: 96, particles: 8, glow: 30, ringWave: false, label: false, dim: false },
  rare: { size: 118, particles: 16, glow: 45, ringWave: true, label: true, dim: false },
  epic: { size: 140, particles: 26, glow: 70, ringWave: true, label: true, dim: false },
  legendary: { size: 168, particles: 40, glow: 110, ringWave: true, label: true, dim: true },
};

function RingWave({ size, ring }: { size: number; ring: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false);
  }, [v]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + v.value * 2.8 }],
    opacity: 0.9 * (1 - v.value),
  }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring }, style]} />;
}

function Particle({ emoji, i, count }: { emoji: string; i: number; count: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay((i % 9) * 100, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false));
  }, [v, i]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -220 * v.value }, { scale: 0.4 + v.value * 0.7 }],
    opacity: v.value < 0.2 ? v.value * 5 : 1 - v.value,
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: `${6 + i * (88 / count)}%`, top: "58%" }, style]}>
      <Txt size={14 + (i % 4) * 8}>{emoji}</Txt>
    </Animated.View>
  );
}

export function GiftFx({ gift }: { gift: FxGift }) {
  const tier = gift.tier || "normal";
  const ring = TIER_RING[tier];
  const conf = CONF[tier];

  return (
    <View style={styles.root} pointerEvents="none">
      {conf.dim && <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut} style={styles.dim} />}
      {conf.ringWave && <RingWave size={conf.size} ring={ring} />}

      <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: conf.size,
            height: conf.size,
            borderRadius: conf.size / 2,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: ring,
            backgroundColor: "rgba(255,255,255,.1)",
            shadowColor: ring,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: conf.glow / 4,
            elevation: 10,
          }}
        >
          <Txt size={conf.size * 0.5}>{gift.emoji}</Txt>
        </View>
        {conf.label && (
          <View style={{ alignItems: "center", gap: 3 }}>
            {tier === "legendary" && (
              <Txt weight="extrabold" size={10} color={ring} style={{ letterSpacing: 2 }}>✦ EFSANEVİ ✦</Txt>
            )}
            <Txt weight="displayBold" size={tier === "legendary" ? 22 : 18} color="#fff">
              {gift.name} ×{gift.qty}
            </Txt>
          </View>
        )}
      </Animated.View>

      {Array.from({ length: conf.particles }).map((_, i) => (
        <Particle key={i} emoji={gift.emoji} i={i} count={conf.particles} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 45 },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.55)" },
});
