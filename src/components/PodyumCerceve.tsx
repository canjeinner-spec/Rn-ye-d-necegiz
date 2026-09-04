import { Image } from "expo-image";
import { type ReactNode } from "react";
import { View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { Icon } from "@/icons/Icon";
import { CERCEVE_OLCU, cerceveGorsel, type CerceveKod } from "@/podium/cerceve";
import { C } from "@/theme/colors";

/**
 * Podyumdaki dereceli avatar — kanatlı çerçeve + içine oturan fotoğraf.
 *
 * ÖLÇÜ ÇERÇEVEDEN DEĞİL AVATARDAN VERİLİYOR (`capi`).
 *
 * Önce çerçevenin TUVAL genişliği veriliyordu ve podyum tutarsız görünüyordu:
 * altın tuvalinde uzun bir taç var, gümüşünkinde yok, bronz ise defne çelengi.
 * Aynı tuval genişliğinde üçünün halka çapı bambaşka çıkıyor — göz ise tacı
 * değil AVATARI kıyaslıyor. Artık çağıran "avatar şu kadar olsun" diyor,
 * tuval genişliği ölçülen `capOran`dan geriye hesaplanıyor. Böylece birinci
 * gerçekten büyük, ikinci ile üçüncü birbirine eşit görünüyor.
 *
 * Avatar çerçevenin ARKASINA çiziliyor, çerçeve üstüne biniyor: halkanın iç
 * kenarı fotoğrafın kenarını kapatıyor, "yapıştırılmış" görünmüyor.
 */
export function PodyumCerceve({
  kod,
  capi,
  ad,
  foto,
  bos,
  icerik,
}: {
  kod: CerceveKod;
  /** İstenen avatar çapı (punto). Çerçeve buna göre ölçekleniyor. */
  capi: number;
  ad: string;
  foto?: string;
  /** O derece henüz kimseye ait değil — sönük çerçeve, boş madalyon. */
  bos?: boolean;
  /** Avatar yerine çizilecek şey (oda kapağı gibi). Yoksa `Portrait`. */
  icerik?: ReactNode;
}) {
  const olcu = CERCEVE_OLCU[kod];
  const genislik = capi / olcu.capOran;
  const yukseklik = genislik / olcu.enBoy;

  /**
   * FOTOĞRAF AÇIKLIKTAN BİRAZ BÜYÜK ÇİZİLİYOR.
   *
   * İlk halinde fotoğraf tam açıklık çapındaydı ve arada koyu bir halka
   * kalıyordu ("oturmuyor gibi"). Ölçüldü, iki sebebi vardı:
   *
   *   1. `Portrait` verilen boyutun içine 2 punto kenarlık çiziyor; yani
   *      fotoğrafın gerçek çapı boyut − 4 oluyor. O yüzden +4 ekleniyor.
   *   2. Açıklığın kenarı 1-2 piksellik yumuşak geçişle bitiyor ve fotoğraf
   *      ile halka arasında kıl payı bir çizgi kalıyor.
   *
   * %6 taşma fotoğrafı halkanın ALTINA sokuyor — çerçeveler zaten böyle
   * çalışmak üzere çizilmiş.
   */
  const fotoBoyut = capi * 1.06 + 4;

  return (
    <View style={{ width: genislik, height: yukseklik }}>
      <View
        style={{
          position: "absolute",
          left: olcu.merkezX * genislik - fotoBoyut / 2,
          top: olcu.merkezY * yukseklik - fotoBoyut / 2,
          width: fotoBoyut,
          height: fotoBoyut,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {bos ? (
          <View
            style={{
              width: capi,
              height: capi,
              borderRadius: capi / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,.045)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.10)",
            }}
          >
            <Icon name="user" size={capi * 0.36} color={C.dim2} />
          </View>
        ) : icerik ? (
          <View style={{ width: fotoBoyut, height: fotoBoyut, borderRadius: fotoBoyut / 2, overflow: "hidden" }}>
            {icerik}
          </View>
        ) : (
          // Halka YOK: çerçevenin kendi halkası zaten var, ikisi üst üste
          // binince kalın bir çerçeve içinde ince bir çerçeve görünüyordu.
          <Portrait name={ad} photo={foto} size={fotoBoyut} ring="transparent" />
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
