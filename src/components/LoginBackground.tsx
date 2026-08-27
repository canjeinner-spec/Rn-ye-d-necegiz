import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/**
 * Giriş ekranı hareketli arka planı.
 *
 * Katmanlar (alttan üste):
 *   1) login_bg.jpg   — poster. Video hazır olana kadar siyah ekran olmasın
 *                        diye anında basılır; video açılınca üstünü örter.
 *   2) login_loop.mp4 — asıl sahne. Sessiz, sonsuz döngü.
 *   3) ışık zerreleri — kodla üretiliyor, videonun üstünde canlılık katar.
 *   4) alt karartma   — buton yazıları her karede okunur kalsın diye.
 *
 * Video hakkında:
 *   • Ses kanalı tamamen kaldırıldı (dosyada audio stream yok) — ayrıca
 *     oynatıcıda da muted. Giriş ekranı asla ses çıkarmaz.
 *   • Kaynak videonun ilk/son karesi tutmuyordu (fark 48/765 → her turda
 *     görünür zıplama). Ping-pong yapıldı: ileri + ters birleştirildi,
 *     fark 4.7/765'e düştü, döngü artık kesintisiz.
 *   • Sağ alttaki "KlingAI 3.0" filigranı kaldırıldı.
 */

const ZERRE_SAYISI = 14;

type Zerre = { sol: number; ust: number; boyut: number; sure: number; opak: number };

function IsikZerresi({ z, yukseklik }: { z: Zerre; yukseklik: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: z.sure, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t, z.sure]);

  const stil = useAnimatedStyle(() => ({
    transform: [{ translateY: -t.value * yukseklik * 0.1 }],
    opacity: z.opak * (0.3 + t.value * 0.7),
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
  const [videoHazir, setVideoHazir] = useState(false);

  const player = useVideoPlayer(require("@/assets/video/login_loop.mp4"), (p) => {
    p.loop = true;
    p.muted = true; // ses dosyada zaten yok; yine de garanti
    p.play();
  });

  // Video ilk kareyi çizene kadar poster görünsün, sonra yumuşak geçiş.
  useEffect(() => {
    const abone = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setVideoHazir(true);
    });
    return () => abone.remove();
  }, [player]);

  const zerreler = useMemo<Zerre[]>(
    () =>
      Array.from({ length: ZERRE_SAYISI }, (_, i) => ({
        sol: 5 + ((i * 41) % 90),
        // Alt %35'e zerre yok — butonların arkası sakin kalmalı.
        ust: 8 + ((i * 27) % 55),
        boyut: 2 + ((i * 7) % 4),
        sure: 4500 + ((i * 911) % 3500),
        opak: 0.3 + ((i * 17) % 40) / 100,
      })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1) Poster — video hazır olana kadar */}
      <Image source={require("@/assets/images/login_bg.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* 2) Video */}
      {videoHazir && (
        <Animated.View entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill}>
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
        </Animated.View>
      )}

      {/* 3) Işık zerreleri */}
      {zerreler.map((z, i) => (
        <IsikZerresi key={i} z={z} yukseklik={height} />
      ))}

      {/* 4) Alt karartma — buton yazıları okunur kalsın */}
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
