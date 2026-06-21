import { Text, type TextProps, type TextStyle } from "react-native";

import { C } from "@/theme/colors";
import { Font } from "@/theme/fonts";

type Weight = keyof typeof Font;

type TxtProps = TextProps & {
  weight?: Weight;
  size?: number;
  color?: string;
  /** satır yüksekliği çarpanı (size * lh) */
  lh?: number;
  align?: TextStyle["textAlign"];
};

/**
 * Tek tip metin bileşeni. RN'de fontWeight ayrı dosya yüklemediği için
 * weight → doğru font-family varyantı eşlenir (Font sözlüğü).
 */
export function Txt({ weight = "medium", size = 14, color = C.text, lh, align, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: Font[weight],
          fontSize: size,
          color,
          // Android: fazladan font boşluğunu kaldır → metin dikeyde düzgün
          // ortalanır (küçük rozetlerdeki sayıların "gömük" görünmesini önler).
          // iOS bu özelliği yok sayar.
          includeFontPadding: false,
          ...(lh ? { lineHeight: size * lh } : null),
          ...(align ? { textAlign: align } : null),
        },
        style,
      ]}
    />
  );
}
