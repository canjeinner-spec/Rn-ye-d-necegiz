import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/**
 * Basınca görünür tepki veren Pressable sarmalayıcısı.
 *
 * NEDEN: projedeki 836 `Pressable`ın HİÇBİRİ basılı durumu göstermiyordu —
 * ne fonksiyon stili (`style={({ pressed }) => ...}`) ne `android_ripple`
 * kullanılıyordu (ikisi de sıfır kullanım). Dokunulan şey hiç tepki
 * vermeyince uygulama "web sitesi" gibi hissettiriyor; native hissin en ucuz
 * ve en büyük tek kazancı bu.
 *
 * SÖZLEŞME: `Pressable`ın katı bir ÜST KÜMESİ. Bütün propları aynen geçer,
 * yalnız `style`ı sarar. Statik stil bekleyen çağıranlar için davranış
 * değişmez; tek fark basılıyken sönme + hafif küçülme.
 *
 * Toplu regex ile 836 yerin hepsi BİR ANDA değiştirilmiyor (yol haritası
 * 1.4) — dalga dalga, her dalga elle doğrulanarak.
 */

/** Basılı durum — küçülmeyen (bar/sekme gibi sabit kutular). */
const BASILI = { opacity: 0.6 } as const;
/** Basılı durum — varsayılan, hafif içeri çöker. */
const BASILI_KUCUK = { opacity: 0.6, transform: [{ scale: 0.97 }] } as const;
/** Android dalgası — koyu zeminde görünen, kutuyla sınırlı beyaz. */
const DALGA = { color: "rgba(255,255,255,0.10)", borderless: false } as const;

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Küçülme kapatılabilir; sabit yükseklikli barlarda zıplama yapmasın diye. */
  kucul?: boolean;
  children?: ReactNode;
};

export function Touch({ style, kucul = true, android_ripple, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      // `null` geçen çağıran dalgayı bilerek kapatmış olur; yalnız hiç
      // geçilmediğinde varsayılanı koyuyoruz.
      android_ripple={android_ripple === undefined ? DALGA : android_ripple}
      style={({ pressed }) => [style, pressed && (kucul ? BASILI_KUCUK : BASILI)]}
    />
  );
}
