import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { C } from "./colors";

/**
 * İçerik kartı — ortak yüzey.
 *
 * NEDEN VAR: uygulamada aynı "beyaz üstü şeffaf kart" her ekranda elle
 * yazılıyordu ve beş farklı alfa, altı farklı kenarlık alfası birikmişti
 * (ölçüm ve gerekçe `colors.ts`teki yüzey katları notunda). Renkler token'a
 * indirildi; bu bileşen de KARTIN KENDİSİNİ tek yerde topluyor, böylece bir
 * sonraki ekran yine kendi yuvarlaklığını ve kenarlığını uydurmuyor.
 *
 * `GlassPanel`in yerine geçmez: o, sayfa/panel yüzeyi (bulanıklık + gradyan).
 * `Kart` düz ve ucuz — liste satırlarında ve içerik kutularında kullanılır.
 *
 * KULLANIM
 *   <Kart>...</Kart>                       // standart içerik kartı
 *   <Kart kat="ust">...</Kart>             // seçili / öne çıkan
 *   <Kart vurgu={C.gold}>...</Kart>        // kenarlık hediyenin/durumun rengi
 *   <Kart dolgu={0} radius={20} style={…}> // düzen kartın dışında kalsın
 */

type Props = {
  children?: React.ReactNode;
  /** Yüzey katı — `colors.ts`teki üç kat. */
  kat?: "kart" | "kontrol" | "ust";
  /** Köşe yuvarlaklığı. Ölçülen baskın değer 16. */
  radius?: number;
  /** İç boşluk. 0 verilirse çocuk kendi dolgusunu yönetir. */
  dolgu?: number;
  /**
   * Kenarlığı bu renge boyar (durum/kademe rengi). Verilmezse `C.line`.
   * Alfa burada ekleniyor ki çağıran her seferinde "+38" yazmasın.
   */
  vurgu?: string;
  style?: StyleProp<ViewStyle>;
};

const ZEMIN = { kart: C.kart, kontrol: C.kontrol, ust: C.kartUst } as const;

export function Kart({ children, kat = "kart", radius = 16, dolgu = 14, vurgu, style }: Props) {
  return (
    <View
      style={[
        styles.taban,
        {
          backgroundColor: ZEMIN[kat],
          borderColor: vurgu ? vurgu + "3D" : C.line,
          borderRadius: radius,
          padding: dolgu,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  taban: { borderWidth: 1, overflow: "hidden" },
});
