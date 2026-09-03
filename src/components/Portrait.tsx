import { Image } from "expo-image";
import { useEffect, useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { Icon } from "@/icons/Icon";
import { PEOPLE } from "@/data/people";
import { C } from "@/theme/colors";

/**
 * Avatar — web mockup'taki `Portrait`. Taban: SVG silüet (radyal gradyan + saç/gövde).
 * Foto yüklenirse silüeti kapatır; yüklenmezse silüet kalır (graceful fallback).
 * muted → mikrofon-kapalı rozeti; online → yeşil nokta.
 */
type PortraitProps = {
  name: string;
  size?: number;
  ring?: string;
  glow?: boolean;
  muted?: boolean;
  online?: boolean;
  frameBorder?: string;
  photo?: string;
};

export function Portrait({
  name,
  size = 56,
  ring,
  glow,
  muted,
  online,
  frameBorder = C.bg,
  photo,
}: PortraitProps) {
  const p = PEOPLE[name] || PEOPLE.Sen;
  const src = photo || p.photo;
  const [imgOk, setImgOk] = useState(true);
  /**
   * Fotoğraf YÜKLENDİ mi.
   *
   * Silüet SVG'si fotoğraf yüklendikten sonra da çiziliyordu — tamamen
   * kapalı olduğu hâlde. Her Portrait bir SVG ağacı (gradyan + iki daire +
   * dört-beş path) ve bu bileşen uygulamadaki HER avatarda kullanılıyor:
   * sohbet satırları, koltuklar, kullanıcı listesi, kalabalık şeridi.
   * Yükleme bitince silüet kaldırılıyor; yüklenene kadar duruyor, çünkü
   * yerine boşluk koymak "yanıp sönen avatar" demek olurdu.
   */
  const [yuklendi, setYuklendi] = useState(false);
  const gid = "pg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ringColor = ring || "rgba(255,255,255,.14)";
  const fotoVar = !!src && imgOk;
  // Kaynak değişince (liste satırı geri dönüştürüldü, kullanıcı fotoğrafını
  // değiştirdi) baştan başla; yoksa yeni fotoğraf yüklenirken eskisinin
  // "yüklendi" durumu silüeti gizli tutar.
  useEffect(() => { setYuklendi(false); setImgOk(true); }, [src]);

  return (
    <View style={{ width: size, height: size }}>
      {/* Halka ve kırpma AYRI katmanlarda.
          Tek View'de `borderWidth` + `overflow:"hidden"` birlikte kullanılınca
          çocuk, dış yarıçapa göre kırpılıyor; foto köşelerden halkanın altına
          taşıp avatar "tam oturmamış" görünüyordu. Dıştaki View yalnız halkayı
          çiziyor, içteki View iç yarıçapla kırpıyor. */}
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: ringColor,
          },
          glow
            ? {
                shadowColor: ring || C.gold,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: 8,
                elevation: 6,
              }
            : null,
        ]}
      >
        <View style={{ flex: 1, borderRadius: (size - 4) / 2, overflow: "hidden" }}>
        {/* Taban silüet — fotoğraf yüklenene kadar. Yüklendiyse tamamen
            kapalı kalacağı için hiç çizilmiyor. */}
        {!(fotoVar && yuklendi) && (
        <Svg viewBox="0 0 100 100" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <RadialGradient id={gid} cx="50%" cy="32%" r="120%">
            <Stop offset="0%" stopColor={p.bg[0]} />
            <Stop offset="100%" stopColor={p.bg[1]} />
          </RadialGradient>
          <Rect width={100} height={100} fill={`url(#${gid})`} />
          <Circle cx={78} cy={20} r={3} fill={p.acc} opacity={0.5} />
          <Circle cx={22} cy={32} r={2} fill="#fff" opacity={0.25} />
          <Circle cx={68} cy={42} r={1.6} fill="#fff" opacity={0.2} />
          <Path d="M13 102 C13 76 31 65 50 65 C69 65 87 76 87 102 Z" fill="#0D0B12" />
          <Rect x={43} y={52} width={14} height={14} rx={4} fill="#0D0B12" />
          <Ellipse cx={50} cy={41} rx={16.5} ry={18.5} fill="#0D0B12" />
          <Ellipse cx={50} cy={31} rx={17.5} ry={13.5} fill={p.hair} />
          {p.style === "long" && (
            <>
              <Path d="M33.5 36 C30 54 31 64 26 74 C36 71 40 58 38 42 Z" fill={p.hair} />
              <Path d="M66.5 36 C70 54 69 64 74 74 C64 71 60 58 62 42 Z" fill={p.hair} />
            </>
          )}
          <Path d="M62 27 C67.5 33 68 48 63.5 57" stroke={p.acc} strokeWidth={1.6} fill="none" opacity={0.85} strokeLinecap="round" />
          <Path d="M70 70 C79 75 84 86 85.5 100" stroke={p.acc} strokeWidth={1.6} fill="none" opacity={0.5} strokeLinecap="round" />
        </Svg>
        )}

        {/* gerçek foto — yüklenince silüetin yerini alır */}
        {fotoVar && (
          <Image
            source={{ uri: src }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            /**
             * Uygulamadaki BÜTÜN avatarlar bu bileşenden geçiyor; görsel
             * ayarları burada olunca tek yerden yönetiliyor.
             *
             * `cachePolicy` hiçbir yerde verilmemişti (31 dosyada sıfır
             * kullanım). `memory-disk`: aynı avatar liste kaydırırken ve
             * ekranlar arasında gezerken yeniden çözülmüyor.
             *
             * `transition` varsayılanı 0 — görseller "pat" diye beliriyordu.
             * 160 ms yumuşak geçiş, native hissin ucuz ve görünür parçası.
             *
             * `recyclingKey`: satır geri dönüştürüldüğünde önceki kişinin
             * fotoğrafı bir kare görünmesin. FlatList'e geçince (1.5) şart
             * olacak; şimdiden doğru.
             */
            cachePolicy="memory-disk"
            transition={160}
            recyclingKey={src}
            onLoad={() => setYuklendi(true)}
            onError={() => setImgOk(false)}
          />
        )}
        </View>
      </View>

      {/* Mikrofon-kapalı rozeti sağ altta. Eskiden avatarın tam ortasının
          altındaydı (left "50%"), yüzün üstüne biniyordu. */}
      {muted && (
        <View
          style={[
            styles.badge,
            {
              width: size * 0.34,
              height: size * 0.34,
              borderRadius: (size * 0.34) / 2,
              bottom: 0,
              right: 0,
              borderColor: frameBorder,
              borderWidth: 2,
            },
          ]}
        >
          <Icon name="micOff" size={size * 0.19} sw={2} color="#D9D7E0" />
        </View>
      )}

      {/* İkisi birden varsa çevrimiçi noktası sağ üste kaçar, üst üste binmez */}
      {online && (
        <View
          style={{
            position: "absolute",
            ...(muted ? { top: size * 0.02 } : { bottom: size * 0.02 }),
            right: size * 0.02,
            width: size * 0.26,
            height: size * 0.26,
            borderRadius: (size * 0.26) / 2,
            backgroundColor: C.green,
            borderWidth: 2.5,
            borderColor: frameBorder,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    backgroundColor: "rgba(8,8,14,.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
