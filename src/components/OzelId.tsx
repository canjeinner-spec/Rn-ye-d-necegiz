import { Image } from "expo-image";
import { Text, View } from "react-native";

import { PremiumBanner, type PremiumFrame } from "@/components/PremiumBanner";
import { OZEL_ID_TEMA_RENK, type OzelIdKart } from "@/data/specialId";
import { Gradient } from "@/theme/Gradient";
import { Font } from "@/theme/fonts";

// 25 premium ÖZEL ID kart çerçevesi — kullanıcının kendi ürettiği gerçek sanat.
const CARD = {
  bronze: require("@/assets/badges/idcard/bronze.png"),
  silver: require("@/assets/badges/idcard/silver.png"),
  gold: require("@/assets/badges/idcard/gold.png"),
  platinum: require("@/assets/badges/idcard/platinum.png"),
  diamond: require("@/assets/badges/idcard/diamond.png"),
  legendary: require("@/assets/badges/idcard/legendary.png"),
  mythic: require("@/assets/badges/idcard/mythic.png"),
  celestial: require("@/assets/badges/idcard/celestial.png"),
  void: require("@/assets/badges/idcard/void.png"),
  emerald: require("@/assets/badges/idcard/emerald.png"),
  pearl: require("@/assets/badges/idcard/pearl.png"),
  ice: require("@/assets/badges/idcard/ice.png"),
  dragon: require("@/assets/badges/idcard/dragon.png"),
  shadow: require("@/assets/badges/idcard/shadow.png"),
  cyber: require("@/assets/badges/idcard/cyber.png"),
  royal: require("@/assets/badges/idcard/royal.png"),
  demon: require("@/assets/badges/idcard/demon.png"),
  holy: require("@/assets/badges/idcard/holy.png"),
  futuristic: require("@/assets/badges/idcard/futuristic.png"),
  nature: require("@/assets/badges/idcard/nature.png"),
  samurai: require("@/assets/badges/idcard/samurai.png"),
  pirate: require("@/assets/badges/idcard/pirate.png"),
  steampunk: require("@/assets/badges/idcard/steampunk.png"),
  music: require("@/assets/badges/idcard/music.png"),
  star: require("@/assets/badges/idcard/star.png"),
} as const;

export const OZEL_ID_KART_KAYNAK = CARD;

/** Kart görsellerinin GERÇEK en-boy oranı (kaynak PNG'den ölçüldü). */
const KART_ORAN: Record<OzelIdKart, number> = {
  bronze: 1.520, silver: 1.633, gold: 1.587, platinum: 1.630,
  diamond: 1.679, legendary: 1.582, mythic: 1.708, celestial: 1.689,
  void: 1.772, emerald: 1.523, pearl: 1.654, ice: 1.734,
  dragon: 1.657, shadow: 1.952, cyber: 1.701, royal: 1.590,
  demon: 1.829, holy: 2.018, futuristic: 1.724, nature: 1.829,
  samurai: 1.863, pirate: 1.670, steampunk: 1.796, music: 1.887,
  star: 1.848,
};

// Kartın gövdesindeki slot oranları (görsel W×H'ye göre). Kartların ID-kart
// düzeni ortak: solda kişi ikonu, sağda metin bantları. Kanatlı kartlarda
// gövde biraz dar; varsayılan çoğunu tutar, gerekirse frame'e özel geçilebilir.
const PHOTO_RECT = { l: 0.235, r: 0.4, t: 0.42, b: 0.74 };
// ID plakası: kartların sağ metin-bandı bölgesi (kişi ikonunun sağı). Baked
// bantların üstüne temiz bir "plaka" oturur — her kartta okunaklı/tutarlı.
const PLATE_RECT = { l: 0.47, r: 0.8, t: 0.44, b: 0.65 };
const CARD_RATIO = 1.9; // ortalama en-boy (yükseklik = genişlik / oran)

/**
 * Premium ÖZEL ID kartı (≤5 basamak). Çerçeve çizilir, ID metni sağ metin
 * bandına ince temalı bir plakayla yazılır; opsiyonel foto kişi slotuna oturur.
 */
export function OzelIdKart({
  frame,
  id,
  photo,
  width = 230,
}: {
  frame: OzelIdKart;
  id: string;
  photo?: string;
  width?: number;
}) {
  const height = width / CARD_RATIO;
  const t = OZEL_ID_TEMA_RENK[frame];
  const px = PHOTO_RECT, pl = PLATE_RECT;
  const plateH = height * (pl.b - pl.t);
  return (
    <View style={{ width, height }}>
      <Image source={CARD[frame]} style={{ width, height }} contentFit="contain" />

      {photo && (
        <Image
          source={{ uri: photo }}
          style={{
            position: "absolute",
            left: width * px.l,
            top: height * px.t,
            width: width * (px.r - px.l),
            height: height * (px.b - px.t),
            borderRadius: 6,
          }}
          contentFit="cover"
        />
      )}

      {!!id && (
        <View
          style={{
            position: "absolute",
            left: width * pl.l,
            top: height * pl.t,
            width: width * (pl.r - pl.l),
            height: plateH,
            borderRadius: plateH * 0.32,
            backgroundColor: "rgba(8,6,10,0.62)",
            borderWidth: 1,
            borderColor: t.accent,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: plateH * 0.3,
          }}
          pointerEvents="none"
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: Font.displayBold,
              fontSize: plateH * 0.62,
              color: t.accent,
              letterSpacing: 1.5,
              includeFontPadding: false,
              textShadowColor: "rgba(0,0,0,.7)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {id}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * ID kapsülü (6–7 basamak). Başta o temanın kart amblemi (gerçek sanat),
 * ardından temanın rengiyle BİREBİR uyumlu kapsülün içinde ID. Kart çerçevesi
 * yok; kartın küçük hâli "rozet" olarak başta durur.
 */
export function IdKapsul({ theme, id, size = 13 }: { theme: OzelIdKart; id: string; size?: number }) {
  const t = OZEL_ID_TEMA_RENK[theme];
  const emblemH = size * 2.15;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: -size * 0.25 }}>
      {/* baştaki rozet = o temanın kartının küçük hâli. Genişlik kartın KENDİ
          oranından gelir; sabit 1.9 kullanılınca oranı düşük kartlar (bronze
          1.52, emerald 1.52) kutunun içinde küçülüp kayıyordu. */}
      <Image source={CARD[theme]} style={{ width: emblemH * KART_ORAN[theme], height: emblemH }} contentFit="contain" />
      <Gradient
        colors={t.g}
        deg={180}
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: size * 0.26,
          paddingLeft: size * 0.9,
          paddingRight: size * 0.72,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.accent,
        }}
      >
        <Text
          style={{
            fontFamily: Font.extrabold,
            fontSize: size,
            color: t.ink,
            letterSpacing: 1.2,
            includeFontPadding: false,
          }}
        >
          {id}
        </Text>
      </Gradient>
    </View>
  );
}

/**
 * ÖZEL ID gösterim — tip'e göre:
 *   premium → hazır banner görseli (ID görsele baked, overlay YOK)
 *   kapsul  → kart amblemi + renk-uyumlu hap (IdKapsul)
 * tema yoksa düz ID metni.
 */
export function OzelIdGosterim({
  id,
  tip,
  tema,
  premiumWidth = 220,
  kapsulSize = 12,
}: {
  id: string;
  tip?: "premium" | "kapsul" | null;
  tema?: string | null;
  premiumWidth?: number;
  kapsulSize?: number;
}) {
  // ID artık görsele çizili değil; çerçevenin boş paneline uygulama yazıyor.
  if (tip === "premium" && tema) return <PremiumBanner frame={tema as PremiumFrame} id={id} width={premiumWidth} />;
  if (tip === "kapsul" && tema) return <IdKapsul theme={tema as OzelIdKart} id={id} size={kapsulSize} />;
  return (
    <Text style={{ fontFamily: Font.extrabold, fontSize: kapsulSize, color: "#F5CE6E", letterSpacing: 1 }}>
      {id}
    </Text>
  );
}
