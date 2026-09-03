import { type ComponentProps, type ReactNode } from "react";
import type LottieView from "lottie-react-native";
import { StyleSheet, View } from "react-native";

import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { C } from "@/theme/colors";
import { Anim } from "./Anim";
import { Txt } from "./Txt";

/**
 * Boş liste / boş ekran anlatımı — TEK kaynak.
 *
 * NEDEN: aynı görsel kalıp (altın halkalı ikon + kalın başlık + soluk alt
 * yazı) en az üç yerde ayrı ayrı kopyalanmıştı: `(tabs)/index.tsx` içinde
 * satır arası, `(tabs)/rank.tsx` içinde yerel `Bos`, `wallet.tsx` içinde
 * yerel `BosDefter`. Görünüm aynı, kod üç farklı yerde.
 *
 * `anim` verilirse Lottie çizilir, verilmezse eski ikon davranışı aynen
 * sürer. Böylece ekranlar tek tek ve elle doğrulanarak geçebilir; hepsini
 * birden değiştirmek gerekmiyor.
 */

type Props = {
  /** Başlıksız da kullanılabilir: bazı ekranlarda metin tek cümle. */
  baslik?: string;
  alt?: string;
  /** Lottie kaynağı. Verilirse ikon yerine bu çizilir. */
  anim?: ComponentProps<typeof LottieView>["source"];
  /** Animasyon yokken çizilecek ikon (eski davranış). */
  ikon?: IconName;
  /** Animasyonun kutu kenarı. */
  animBoyut?: number;
  /** Kart zemini (wallet.tsx gibi kutu içinde duran boş durumlar için). */
  kart?: boolean;
  /** Dikey dolgu. Ekrandan ekrana değişiyordu: 34 / 44 / 54. */
  dolgu?: number;
  /** Metnin altına eklenecek şey — envanterdeki "Mağazaya git" gibi. */
  children?: ReactNode;
};

export function BosDurum({ baslik, alt, anim, ikon = "mic", animBoyut = 150, kart = false, dolgu, children }: Props) {
  return (
    <View style={[styles.sar, kart && styles.kart, dolgu !== undefined && { paddingVertical: dolgu }]}>
      {anim ? (
        // Boş ekran ikincil bir andır; hız biraz düşük, dikkat çalmasın.
        <Anim kaynak={anim} boyut={animBoyut} hiz={0.8} />
      ) : (
        <View style={styles.ikon}>
          <Icon name={ikon} size={20} color={C.gold} />
        </View>
      )}
      {!!baslik && (
        <Txt weight="displayBold" size={14} color="#fff" style={{ marginTop: anim ? 2 : 12 }}>
          {baslik}
        </Txt>
      )}
      {!!alt && (
        <Txt
          size={baslik ? 11.5 : 12.5}
          color={C.dim}
          align="center"
          lh={1.5}
          style={{ marginTop: baslik ? 6 : anim ? 4 : 12, maxWidth: 260 }}
        >
          {alt}
        </Txt>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sar: { alignItems: "center", paddingVertical: 44, paddingHorizontal: 18 },
  kart: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.07)",
  },
  ikon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.gold + "1A",
    borderWidth: 1,
    borderColor: C.gold + "3D",
  },
});
