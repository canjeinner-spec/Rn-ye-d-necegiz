import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Icon } from "@/icons/Icon";
import { INTRO_SLIDES, type IntroSlide } from "@/data/onboarding";
import { Txt } from "@/components/Txt";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AUTOPLAY_MS = 3500;
const N = INTRO_SLIDES.length;

/**
 * Weplay tarzı açılış tanıtım karuseli: yatay sayfalı kaydırma + otomatik
 * ilerleme + parallax/scale geçişleri + nefes alan ikon glow + noktalı gösterge.
 * Kendi içinde toplu; onboarding "home" adımına gömülür.
 */
export function IntroCarousel() {
  const { width: W } = useWindowDimensions();
  const aref = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const indexRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const advance = useCallback(() => {
    const next = (indexRef.current + 1) % N;
    indexRef.current = next;
    const x = next * W;
    runOnUI(() => {
      "worklet";
      scrollTo(aref, x, 0, true);
    })();
  }, [W, aref]);

  const clear = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  const start = useCallback(() => {
    clear();
    timer.current = setInterval(advance, AUTOPLAY_MS);
  }, [advance, clear]);

  useEffect(() => {
    start();
    return clear;
  }, [start, clear]);

  // Elle kaydırma bitince aktif indexi güncelle ve sayacı yeniden başlat.
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    indexRef.current = Math.round(e.nativeEvent.contentOffset.x / W);
    start();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <Animated.ScrollView
        ref={aref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={clear}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ flexGrow: 0 }}
      >
        {INTRO_SLIDES.map((s, i) => (
          <Slide key={s.title} slide={s} index={i} scrollX={scrollX} width={W} />
        ))}
      </Animated.ScrollView>

      <Dots scrollX={scrollX} width={W} />
    </View>
  );
}

function Slide({ slide, index, scrollX, width }: { slide: IntroSlide; index: number; scrollX: SharedValue<number>; width: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  // scrollX'e göre parallax/scale/opacity — aktif slayt büyür ve netleşir.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.35, 1, 0.35], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollX.value, inputRange, [0.82, 1, 0.82], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollX.value, inputRange, [22, 0, 22], Extrapolation.CLAMP) },
    ],
  }));

  // Nefes alan glow halkası (Eq.tsx kalıbı).
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 + pulse.value * 8 }],
  }));

  return (
    <View style={{ width, alignItems: "center", paddingHorizontal: 36 }}>
      <Animated.View style={[{ alignItems: "center" }, contentStyle]}>
        <View style={styles.badgeWrap}>
          <Animated.View style={[styles.glow, { backgroundColor: slide.accent }, glowStyle]} />
          <Animated.View style={floatStyle}>
            <View style={[styles.badge, { borderColor: slide.accent + "55" }]}>
              <Gradient colors={[slide.accent + "33", "rgba(255,255,255,.02)"]} deg={135} style={StyleSheet.absoluteFill} />
              <Icon name={slide.icon} size={44} sw={1.8} color={slide.accent} />
            </View>
          </Animated.View>
        </View>

        <Txt weight="displayBold" size={23} color="#fff" align="center" style={{ marginTop: 34 }}>{slide.title}</Txt>
        <Txt size={13} color={C.dim} lh={1.6} align="center" style={{ marginTop: 10, maxWidth: 280 }}>{slide.desc}</Txt>
      </Animated.View>
    </View>
  );
}

function Dots({ scrollX, width }: { scrollX: SharedValue<number>; width: number }) {
  return (
    <View style={styles.dots}>
      {INTRO_SLIDES.map((_, i) => (
        <Dot key={i} index={i} scrollX={scrollX} width={width} />
      ))}
    </View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, inputRange, [6, 22, 6], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(scrollX.value, inputRange, [C.dim2, C.gold, C.dim2]),
    opacity: interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  badgeWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 110, height: 110, borderRadius: 55 },
  badge: {
    width: 96, height: 96, borderRadius: 30, borderWidth: 1, overflow: "hidden",
    alignItems: "center", justifyContent: "center", backgroundColor: C.kart,
  },
  dots: { flexDirection: "row", gap: 7, alignSelf: "center", marginTop: 30 },
  dot: { height: 6, borderRadius: 3 },
});
