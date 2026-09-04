import { Image } from "expo-image";
import { View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { CERCEVE_OLCU, cerceveGorsel, type CerceveKod } from "@/podium/cerceve";

/**
 * Podyumdaki dereceli avatar — kanatlı çerçeve + içine oturan fotoğraf.
 *
 * Avatar çerçevenin ARKASINA çiziliyor, çerçeve üstüne biniyor: halkanın iç
 * kenarı fotoğrafın kenarını kapatıyor, "yapıştırılmış" görünmüyor.
 *
 * Konum göz kararı DEĞİL: `cerceve.ts`teki oranlar görselin içindeki dairesel
 * açıklıktan ölçüldü (`scripts/cerceve-hazirla.js`). Çerçeve değişirse betik
 * yeniden çalışır, kod aynı kalır.
 *
 * `genislik` çerçevenin genişliği; yükseklik en/boy oranından geliyor. Kanatlar
 * yatayda geniş olduğu için podyum hücresinin genişliğini bu belirlemeli.
 */
export function PodyumCerceve({
  kod,
  genislik,
  ad,
  foto,
}: {
  kod: CerceveKod;
  genislik: number;
  ad: string;
  foto?: string;
}) {
  const olcu = CERCEVE_OLCU[kod];
  const yukseklik = genislik / olcu.enBoy;
  const cap = genislik * olcu.capOran;

  return (
    <View style={{ width: genislik, height: yukseklik }}>
      <View
        style={{
          position: "absolute",
          left: olcu.merkezX * genislik - cap / 2,
          top: olcu.merkezY * yukseklik - cap / 2,
          width: cap,
          height: cap,
        }}
      >
        {/* Halka YOK: çerçevenin kendi halkası zaten var, ikisi üst üste
            binince kalın bir çerçeve içinde ince bir çerçeve görünüyordu. */}
        <Portrait name={ad} photo={foto} size={cap} ring="transparent" />
      </View>

      <Image
        source={cerceveGorsel(kod)}
        style={{ width: genislik, height: yukseklik }}
        contentFit="contain"
        // Çerçeveler sabit varlık; her açılışta yeniden çözülmesin.
        cachePolicy="memory-disk"
        transition={0}
        pointerEvents="none"
      />
    </View>
  );
}
