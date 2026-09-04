import { Image } from "expo-image";
import { type ReactNode } from "react";
import { View } from "react-native";

import { Portrait } from "@/components/Portrait";
import { Icon } from "@/icons/Icon";
import { CERCEVE_OLCU, cerceveGorsel, kareMi, type CerceveKod } from "@/podium/cerceve";
import { C } from "@/theme/colors";

/**
 * Podyumdaki dereceli avatar — çerçeve + içine oturan fotoğraf/kapak.
 *
 * ÖLÇÜ ÇERÇEVE GENİŞLİĞİNDEN VERİLİYOR (`genislik`), açıklık ondan türüyor.
 *
 * İki tur denendi. Önce tuval genişliği veriliyordu ve ESKİ sette podyum
 * tutarsız çıkıyordu: o setin açıklık oranları birbirinden uzaktı (.548/.550/
 * .589), aynı tuval genişliğinde üçüncünün avatarı ikincininkinden büyük
 * görünüyordu. Sonra avatar çapı verildi; bu sefer DAİRE ve KARE setler farklı
 * kompozisyona oturdu — kare armaların açıklığı tuvalin daha küçük bir bölümü
 * (%27.8'e karşı %31.7), aynı avatar çapı kare çerçeveyi 173 punto genişliğe
 * çıkarıyordu (dairede 151) ve odalar sekmesi sıkışık görünüyordu.
 *
 * Yeni sette üç açıklık oranı birbirine yakın olduğu için genişlikten ölçmek
 * her iki sorunu da çözüyor: sekmeler arası kompozisyon birebir aynı, set
 * içinde avatarlar dereceye göre sıralı kalıyor.
 *
 * Avatar çerçevenin ARKASINA çiziliyor, çerçeve üstüne biniyor: iç kenar
 * fotoğrafın kenarını kapatıyor, "yapıştırılmış" görünmüyor.
 */
export function PodyumCerceve({
  kod,
  genislik,
  ad,
  foto,
  bos,
  icerik,
}: {
  kod: CerceveKod;
  /** Çerçevenin genişliği (punto). Açıklık ölçülen orandan türüyor. */
  genislik: number;
  ad: string;
  foto?: string;
  /** O derece henüz kimseye ait değil — sönük çerçeve, boş madalyon. */
  bos?: boolean;
  /** Avatar yerine çizilecek şey (oda kapağı gibi). Yoksa `Portrait`. */
  icerik?: ReactNode;
}) {
  const olcu = CERCEVE_OLCU[kod];
  const gorsel = cerceveGorsel(kod);
  const kare = kareMi(kod);
  const yukseklik = genislik / olcu.enBoy;
  /** Açıklığın gerçek ölçüsü — fotoğraf/kapak buna oturuyor. */
  const capi = genislik * olcu.capOran;

  /**
   * FOTOĞRAF AÇIKLIKTAN BİRAZ BÜYÜK ÇİZİLİYOR.
   *
   * İlk halinde fotoğraf tam açıklık ölçüsündeydi ve arada koyu bir halka
   * kalıyordu ("oturmuyor gibi"). Ölçüldü, iki sebebi vardı:
   *   1. `Portrait` verilen boyutun İÇİNE 2 punto kenarlık çiziyor; fotoğrafın
   *      gerçek çapı boyut − 4 oluyordu. O yüzden +4 ekleniyor.
   *   2. Açıklığın kenarı 1-2 piksellik yumuşak geçişle bitiyor, arada kıl payı
   *      bir çizgi kalıyordu.
   * %6 taşma fotoğrafı çerçevenin ALTINA sokuyor — çerçeveler böyle çalışmak
   * üzere çizilmiş.
   */
  const fotoBoyut = capi * 1.06 + 4;
  /** Kare açıklıkta köşe yuvarlaklığı; dairede tam yarıçap. */
  const kose = kare ? fotoBoyut * 0.16 : fotoBoyut / 2;

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
              borderRadius: kare ? capi * 0.16 : capi / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,.045)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,.10)",
            }}
          >
            <Icon name={kare ? "home" : "user"} size={capi * 0.36} color={C.dim2} />
          </View>
        ) : icerik ? (
          <View style={{ width: fotoBoyut, height: fotoBoyut, borderRadius: kose, overflow: "hidden" }}>
            {icerik}
          </View>
        ) : kare ? (
          // Kare açıklıkta `Portrait` (dairesel) kullanılamıyor; fotoğraf
          // doğrudan yuvarlatılmış kareye kırpılıyor.
          <View style={{ width: fotoBoyut, height: fotoBoyut, borderRadius: kose, overflow: "hidden", backgroundColor: C.kart }}>
            {!!foto && (
              <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={160} />
            )}
          </View>
        ) : (
          // Halka YOK: çerçevenin kendi halkası zaten var, ikisi üst üste
          // binince kalın bir çerçeve içinde ince bir çerçeve görünüyordu.
          <Portrait name={ad} photo={foto} size={fotoBoyut} ring="transparent" />
        )}
      </View>

      {gorsel && (
        <Image
          source={gorsel}
          style={{ width: genislik, height: yukseklik, opacity: bos ? 0.42 : 1 }}
          contentFit="contain"
          // Çerçeveler sabit varlık; her açılışta yeniden çözülmesin.
          cachePolicy="memory-disk"
          transition={0}
          pointerEvents="none"
        />
      )}
    </View>
  );
}
