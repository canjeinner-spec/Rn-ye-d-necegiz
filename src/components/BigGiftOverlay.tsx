import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Polygon, RadialGradient, Stop } from "react-native-svg";

import { type Gift } from "@/data/gifts";
import { sceneFor } from "@/gifts/bigGifts";
import { Txt } from "@/components/Txt";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const PARTICLES = 16;

function Particle({ i, c }: { i: number; c: string }) {
  const p = useSharedValue(0);
  const angle = (i / PARTICLES) * Math.PI * 2 + (i % 3);
  const dist = 130 + ((i * 37) % 110);
  useEffect(() => {
    p.value = withDelay(220, withTiming(1, { duration: 1100 + (i % 5) * 130, easing: Easing.out(Easing.quad) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.9,
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value },
      { scale: 1 - 0.5 * p.value },
    ],
  }));
  return <Animated.View style={[styles.particle, { backgroundColor: c }, style]} />;
}

function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: (1 - p.value) * 0.6, transform: [{ scale: 0.4 + p.value * 1.6 }] }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

export function BigGiftOverlay({ gift, qty, sender, onDone }: { gift: Gift; qty: number; sender: string; onDone: () => void }) {
  const scene = sceneFor(gift.id);
  const dim = useSharedValue(0);
  const flash = useSharedValue(0);
  const emblem = useSharedValue(0);
  const beam = useSharedValue(0);
  const bannerY = useSharedValue(46);
  const bannerOp = useSharedValue(0);

  useEffect(() => {
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    try {
      player = createAudioPlayer(scene.sound);
      player.volume = 1;
      player.play();
    } catch {}

    dim.value = withTiming(1, { duration: 260 });
    flash.value = withSequence(withTiming(0.85, { duration: 110 }), withTiming(0, { duration: 460 }));
    emblem.value = withDelay(140, withSpring(1, { damping: 8, mass: 0.9, stiffness: 120 }));
    beam.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    bannerOp.value = withDelay(520, withTiming(1, { duration: 320 }));
    bannerY.value = withDelay(520, withSpring(0, { damping: 14 }));

    const t = setTimeout(onDone, scene.duration);
    return () => { clearTimeout(t); player?.remove(); };
  }, []);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const beamStyle = useAnimatedStyle(() => ({ opacity: 0.5 * dim.value, transform: [{ rotate: `${beam.value * 360}deg` }] }));
  const emblemStyle = useAnimatedStyle(() => ({
    opacity: emblem.value,
    transform: [{ scale: 0.3 + emblem.value * 0.7 }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({ opacity: bannerOp.value, transform: [{ translateY: bannerY.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Gradient colors={[`${gift.c2}55`, "rgba(4,3,8,0.82)"]} deg={180} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        {/* dönen ışık huzmeleri */}
        <Animated.View style={[styles.beamWrap, beamStyle]}>
          <Svg width={460} height={460} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={gift.c1} stopOpacity={0.0} />
                <Stop offset="0.55" stopColor={gift.c1} stopOpacity={0.5} />
                <Stop offset="1" stopColor={gift.c1} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const x = 50 + Math.cos(a) * 60;
              const y = 50 + Math.sin(a) * 60;
              const a2 = a + 0.06;
              const x2 = 50 + Math.cos(a2) * 60;
              const y2 = 50 + Math.sin(a2) * 60;
              return <Polygon key={i} points={`50,50 ${x},${y} ${x2},${y2}`} fill="url(#bg)" />;
            })}
          </Svg>
        </Animated.View>

        <Ring delay={0} color={gift.c1} />
        <Ring delay={460} color={gift.c2} />
        <Ring delay={920} color={gift.c1} />

        {Array.from({ length: PARTICLES }).map((_, i) => (
          <View key={i} style={styles.particleWrap} pointerEvents="none">
            <Particle i={i} c={i % 2 ? gift.c1 : "#FDE68A"} />
          </View>
        ))}

        <Animated.View style={[styles.emblem, { shadowColor: gift.c1 }, emblemStyle]}>
          <Txt size={108}>{gift.emoji}</Txt>
        </Animated.View>
      </View>

      <Animated.View style={[styles.banner, bannerStyle]} pointerEvents="none">
        <Gradient colors={[gift.c1, gift.c2]} deg={120} style={styles.bannerInner}>
          <Txt size={26}>{gift.emoji}</Txt>
          <View style={{ minWidth: 0 }}>
            <Txt weight="extrabold" size={13} color="#fff" numberOfLines={1}>{sender} · {gift.name}</Txt>
            <Txt weight="displayBold" size={16} color="#FFF7E0">×{qty}</Txt>
          </View>
        </Gradient>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  beamWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2.5 },
  particleWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  particle: { width: 9, height: 9, borderRadius: 5 },
  emblem: { alignItems: "center", justifyContent: "center", shadowOpacity: 0.9, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  banner: { position: "absolute", left: 0, right: 0, bottom: "22%", alignItems: "center" },
  bannerInner: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,.25)" },
  flash: { backgroundColor: "#fff" },
});
