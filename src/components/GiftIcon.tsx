import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { type Gift, TIER_RING } from "@/data/gifts";
import { sceneFor } from "@/gifts/bigGifts";
import { Anim } from "./Anim";
import { Txt } from "./Txt";

/**
 * Hediye rozeti.
 *
 * Hediyenin kendi Lottie'si varsa GERÇEK GÖRSEL çiziliyor, emoji değil.
 * Ama ızgarada onlarca satır olabilir: yalnız `oynat` verilen (seçili olan)
 * animasyon çalışır, kalanlar TEK KARE olarak boyanır (`ilerleme`). Böylece
 * gerçek görsel görünür ama N tane çizim döngüsü çalışmaz.
 */
export function GiftIcon({ gift, size = 54, oynat = false }: { gift: Gift; size?: number; oynat?: boolean }) {
  const ring = TIER_RING[gift.tier] || TIER_RING.normal;
  const legendary = gift.tier === "legendary";
  const sahne = sceneFor(gift.id);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1.2,
        borderColor: ring,
        backgroundColor: "rgba(255,255,255,.08)",
        shadowColor: ring,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: legendary ? 0.9 : 0.45,
        shadowRadius: legendary ? 10 : 6,
        elevation: 5,
      }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`gi_${gift.id}`} cx="50%" cy="100%" r="70%">
            <Stop offset="0" stopColor={gift.c2} stopOpacity={0.5} />
            <Stop offset="1" stopColor={gift.c2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={size / 2} cy={size} rx={size * 0.55} ry={size * 0.5} fill={`url(#gi_${gift.id})`} />
      </Svg>
      <View style={[styles.glint, { top: size * 0.08, left: size * 0.18, width: size * 0.5, height: size * 0.26, borderRadius: size * 0.25 }]} />
      {sahne.anim ? (
        // Kapsülü taşırmasın diye biraz büyük çiziliyor; `contain` kırpmıyor.
        <Anim kaynak={sahne.anim} boyut={size * 0.92} ilerleme={oynat ? undefined : 0.5} />
      ) : (
        <Txt size={size * 0.46}>{gift.emoji}</Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glint: { position: "absolute", backgroundColor: "rgba(255,255,255,.3)" },
});
