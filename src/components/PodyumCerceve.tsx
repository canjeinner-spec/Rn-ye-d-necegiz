import { Image } from "expo-image";
import { View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { Icon } from "@/icons/Icon";
import { CERCEVE_OLCU, cerceveGorsel, type CerceveKod } from "@/podium/cerceve";
import { C } from "@/theme/colors";

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
  bos,
}: {
  kod: CerceveKod;
  genislik: number;
  ad: string;
  foto?: string;
  /** O derece henüz kimseye ait değil — sönük çerçeve, boş madalyon. */
  bos?: boolean;
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
        {bos ? (
          <View
            style={{
              width: cap,
              height: cap,
              borderRadius: cap / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,.045)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.10)",
            }}
          >
            <Icon name="user" size={cap * 0.36} color={C.dim2} />
          </View>
        ) : (
          // Halka YOK: çerçevenin kendi halkası zaten var, ikisi üst üste
          // binince kalın bir çerçeve içinde ince bir çerçeve görünüyordu.
          <Portrait name={ad} photo={foto} size={cap} ring="transparent" />
        )}
      </View>

      <Image
        source={cerceveGorsel(kod)}
        style={{ width: genislik, height: yukseklik, opacity: bos ? 0.42 : 1 }}
        contentFit="contain"
        // Çerçeveler sabit varlık; her açılışta yeniden çözülmesin.
        cachePolicy="memory-disk"
        transition={0}
        pointerEvents="none"
      />
    </View>
  );
}
