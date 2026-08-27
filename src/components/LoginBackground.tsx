import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Giriş ekranı hareketli arka planı — üç katmanlı parallax.
 *
 *   1) login_bg.jpg   gece gökyüzü + şehir silüeti  → en yavaş, sağa süzülür
 *   2) login_mid.png  altın ses dalgaları (şeffaf)  → daha hızlı, ters yöne
 *   3) ışık zerreleri (KODLA üretiliyor)            → en hızlı, nefes alır
 *
 * Üçüncü katman görselden değil koddan geliyor: GPT'nin ürettiği bokeh
 * katmanının alfası bozuktu (sert sarı/kırmızı bantlar). Zerreler zaten
 * yumuşak altın noktalardan ibaret; kodla üretince dosya yükü sıfır,
 * hareket ve yoğunluk tam kontrol edilebiliyor.
 *
 * Yeni bağımlılık yok: expo-image + reanimated + expo-linear-gradient.
 * Video/Lottie/SVGA gerekmiyor, Expo Go'da doğrudan çalışır.
 */

const ZERRE_SAYISI = 18;

type Zerre = { sol: number; ust: number; boyut: number; sure: number; gecikme: number; opak: number };

function IsikZerresi({ z, yukseklik }: { z: Zerre; yukseklik: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: z.sure, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [t, z.sure]);

  const stil = useAnimatedStyle(() => ({
    // yukarı süzülme + nefes alan opaklık
    transform: [{ translateY: -t.value * yukseklik * 0.12 }],
    opacity: z.opak * (0.35 + t.value * 0.65),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: `${z.sol}%`,
          top: `${z.ust}%`,
          width: z.boyut,
          height: z.boyut,
          borderRadius: z.boyut / 2,
          backgroundColor: C.gold2,
          // yumuşak parıltı — keskin daire yerine ışık lekesi
          shadowColor: C.gold,
          shadowOpacity: 0.9,
          shadowRadius: z.boyut * 0.9,
          shadowOffset: { width: 0, height: 0 },
        },
        stil,
      ]}
    />
  );
}

export function LoginBackground() {
  const { height } = useWindowDimensions();

  // Konumlar bir kez üretilir; her render'da zıplamasın.
  const zerreler = useMemo<Zerre[]>(
    () =>
      Array.from({ length: ZERRE_SAYISI }, (_, i) => ({
        sol: 4 + ((i * 37) % 92),
        // Alt %35'e zerre koyma — butonlar orada, arkası sakin kalmalı.
        ust: 6 + ((i * 23) % 58),
        boyut: 2 + ((i * 7) % 5),
        sure: 4200 + ((i * 811) % 3600),
        gecikme: (i * 260) % 2000,
        opak: 0.35 + ((i * 13) % 40) / 100,
      })),
    [],
  );

  // Katman kaydırmaları — farklı hız ve yön = derinlik hissi
  const arka = useSharedValue(0);
  const orta = useSharedValue(0);
  useEffect(() => {
    arka.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.inOut(Easing.ease) }), -1, true);
    orta.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [arka, orta]);

  const arkaStil = useAnimatedStyle(() => ({
    transform: [{ translateX: -14 + arka.value * 28 }, { scale: 1.08 }],
  }));
  const ortaStil = useAnimatedStyle(() => ({
    transform: [{ translateX: 20 - orta.value * 40 }, { translateY: -6 + orta.value * 12 }],
    opacity: 0.75 + orta.value * 0.25,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1) Arka katman */}
      <Animated.View style={[StyleSheet.absoluteFill, arkaStil]}>
        <Image source={require("@/assets/images/login_bg.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      {/* 2) Altın dalgalar */}
      <Animated.View style={[StyleSheet.absoluteFill, ortaStil]}>
        <Image source={require("@/assets/images/login_mid.png")} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      {/* 3) Işık zerreleri */}
      {zerreler.map((z, i) => (
        <IsikZerresi key={i} z={z} yukseklik={height} />
      ))}

      {/* Alt karartma — butonların arkası sakin ve okunur kalsın */}
      <Gradient
        colors={["transparent", "rgba(8,8,12,.55)", C.bg]}
        deg={180}
        locations={[0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}
