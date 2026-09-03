import type LottieView from "lottie-react-native";
import { type ComponentProps, useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { C } from "@/theme/colors";
import { Anim } from "./Anim";
import { Txt } from "./Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";

/**
 * Yükleniyor durumu — animasyon + yazı.
 *
 * NEDEN: projede 20 yerde çıplak `ActivityIndicator` vardı; standart dönen
 * çember her uygulamada aynı görünür ve "şablon" hissi verir. Üstelik
 * çoğunda yazı da yoktu, kullanıcı ne beklediğini bilmiyordu.
 *
 * NEREYE KOYULMAZ: buton ve arama kutusu içindeki küçük çemberler
 * (`busy ? <ActivityIndicator .../>`). Oraya 130px animasyon sığmaz ve
 * `ActivityIndicator` zaten doğru araç.
 *
 * FLAŞ KORUMASI: yükleme 200 ms'den kısa sürerse HİÇBİR ŞEY gösterilmez.
 * Yoksa hızlı yüklemelerde animasyon bir kare görünüp kayboluyor ve bu
 * göze arıza gibi çarpıyor. `gecikme={0}` ile kapatılabilir.
 */

type Props = {
  /** Alt/üst yazı. `null` verilirse yazı çizilmez. */
  yazi?: string | null;
  /** Yazının yeri. */
  yaziYeri?: "alt" | "ust";
  /** Animasyon kutusunun kenarı. */
  boyut?: number;
  /** Ortalayıp tüm alanı kaplasın mı. */
  tamEkran?: boolean;
  /** Dikey dolgu (bölüm içi kullanımda). */
  dolgu?: number;
  /** Gösterime başlamadan önceki bekleme (ms). 0 = hemen. */
  gecikme?: number;
  /** Varsayılan dışında bir animasyon kullanmak için. */
  kaynak?: ComponentProps<typeof LottieView>["source"];
  style?: StyleProp<ViewStyle>;
};

export function Yukleniyor({
  yazi = "Yükleniyor",
  yaziYeri = "alt",
  boyut = 120,
  tamEkran = false,
  dolgu = 40,
  gecikme = 200,
  kaynak = BOS_KUTU,
  style,
}: Props) {
  const [gorunur, setGorunur] = useState(gecikme === 0);

  useEffect(() => {
    if (gecikme === 0) return;
    const z = setTimeout(() => setGorunur(true), gecikme);
    return () => clearTimeout(z);
  }, [gecikme]);

  // Bekleme dolmadan yer kaplamayalım ama LAYOUT ZIPLAMASIN diye kutuyu
  // koruyoruz: yükseklik aynı kalır, yalnız içerik boş görünür.
  const govde = (
    <View style={[styles.sar, { paddingVertical: dolgu }, tamEkran && styles.tam, style]}>
      {gorunur && (
        <>
          {yaziYeri === "ust" && !!yazi && <Etiket yazi={yazi} yer="ust" />}
          <Anim kaynak={kaynak} boyut={boyut} hiz={0.9} />
          {yaziYeri === "alt" && !!yazi && <Etiket yazi={yazi} yer="alt" />}
        </>
      )}
    </View>
  );
  return govde;
}

function Etiket({ yazi, yer }: { yazi: string; yer: "alt" | "ust" }) {
  return (
    <Txt
      weight="semibold"
      size={12.5}
      color={C.dim}
      align="center"
      style={yer === "alt" ? { marginTop: 6 } : { marginBottom: 6 }}
    >
      {yazi}
    </Txt>
  );
}

const styles = StyleSheet.create({
  sar: { alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  tam: { flex: 1 },
});
