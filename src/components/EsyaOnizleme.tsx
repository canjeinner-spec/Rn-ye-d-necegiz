import { StyleSheet, View } from "react-native";

import { BALON_TEMALARI, GIRIS_TEMALARI } from "@/data/esyaTemalari";
import { type EsyaTip } from "@/data/remote/esyaRepo";
import { Icon } from "@/icons/Icon";
import { Gradient } from "@/theme/Gradient";
import { FramePreview } from "./FramePreview";
import { Portrait } from "./Portrait";
import { Txt } from "./Txt";

/**
 * Bir eşyanın görsel önizlemesi — mağaza ve envanterde aynı bileşen.
 *
 * Çerçeve gerçek halkasıyla, giriş efekti tema renginde madalyonla, sohbet
 * balonu da küçük bir örnek balonla gösteriliyor; kullanıcı ne aldığını
 * satın almadan görüyor.
 */
export function EsyaOnizleme({ tip, tema, size = 56 }: { tip: EsyaTip; tema: string; size?: number }) {
  if (tip === "cerceve") {
    return (
      <View style={{ width: size, height: size }}>
        <Portrait name="Sen" size={size} ring="transparent" glow={false} />
        <FramePreview id={tema} size={size} />
      </View>
    );
  }

  if (tip === "giris") {
    const t = GIRIS_TEMALARI[tema] ?? GIRIS_TEMALARI.yildiz;
    return (
      <View style={[styles.girisKutu, { width: size + 26, height: size, borderRadius: size / 2.6 }]}>
        <Gradient colors={[t.g1, t.g2]} deg={135} style={StyleSheet.absoluteFill} />
        <View style={[styles.girisIkon, { borderColor: t.parca + "55", backgroundColor: t.parca + "1F" }]}>
          <Icon name={t.ikon} size={size * 0.34} color={t.parca} />
        </View>
        {/* Parçacık ipucu — efektin rengini tek bakışta versin */}
        <View style={{ flexDirection: "row", gap: 3, marginLeft: 7 }}>
          {[0.9, 0.6, 0.35].map((o, i) => (
            <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.parca, opacity: o }} />
          ))}
        </View>
      </View>
    );
  }

  const b = BALON_TEMALARI[tema] ?? BALON_TEMALARI.sade;
  return (
    <View style={{ alignItems: "flex-start", width: size + 34 }}>
      <Txt weight="bold" size={8.5} color={b.ad} style={{ marginLeft: 4, marginBottom: 3 }}>Sen</Txt>
      <View style={[styles.balon, { backgroundColor: b.bg, borderColor: b.kenar }]}>
        <Txt weight="semibold" size={9.5} color={b.yazi}>Selam millet!</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  girisKutu: { flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  girisIkon: { width: "auto", aspectRatio: 1, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  balon: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 13, borderTopLeftRadius: 4, borderWidth: 1, maxWidth: "100%" },
});

