import LottieView from "lottie-react-native";
import { type ComponentProps } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Lottie animasyonu için tek sarmalayıcı.
 *
 * NEDEN TEK YER: hazır Lottie dosyaları rastgele renklerde geliyor ve
 * performans kuralları her çağıranın aklında tutulamaz. Tema ve kurallar
 * burada, dosya değiştirmek tek satır oluyor. (`Touch.tsx` ile aynı desen.)
 *
 * TEMA: dosyaların rengi ÇALIŞMA ANINDA değil, ÖNCEDEN düzeltiliyor —
 * `scripts/lottie-boya.js` ile. Sebep: `colorFilters` katman ADINA bağlı ve
 * her dosyada katman adı farklı; JSON'u bir kez boyamak kesin sonuç veriyor.
 *
 * KURALLAR (uyulmazsa fayda zarara döner):
 *   • Dosya 100 KB'ı geçmesin. Geçenler genelde gereksiz karmaşık.
 *   • Ekranda aynı anda en fazla bir iki tane olsun.
 *   • LİSTE SATIRINA KOYMA. Her Lottie ayrı bir native görünüm ve kendi
 *     çizim döngüsü var; sohbet satırına konursa 1.3'te kazandığımız her şey
 *     geri gider.
 *   • Oda ekranının içine koyma — zaten en ağır ekran, üstüne Agora gelecek.
 */

type LottieKaynak = ComponentProps<typeof LottieView>["source"];

type Props = {
  /** `import x from "@/anim/x.json"` ile gelen kaynak. */
  kaynak: LottieKaynak;
  /** Kare kutu kenarı (piksel). */
  boyut?: number;
  /** Sürekli dönsün mü. Kapalıyken bir kez oynayıp son karede durur. */
  dongu?: boolean;
  /** 1 = normal. Boş ekranlarda 0.7-0.8 daha sakin durur. */
  hiz?: number;
  /**
   * Verilirse animasyon OYNAMAZ, bu orandaki tek kareyi gösterir (0-1).
   *
   * Listelerde gerçek görseli göstermenin ucuz yolu: her satır kendi
   * çizim döngüsünü çalıştırmaz, yalnız bir kare boyanır. 0 yerine 0.5
   * uygun: hediye animasyonlarının ilk karesi genelde boş olur, nesneler
   * sahneye sonradan giriyor.
   */
  ilerleme?: number;
  style?: StyleProp<ViewStyle>;
};

export function Anim({ kaynak, boyut = 140, dongu = true, hiz = 1, ilerleme, style }: Props) {
  const durukKare = ilerleme !== undefined;
  return (
    <View style={[{ width: boyut, height: boyut }, style]} pointerEvents="none">
      <LottieView
        source={kaynak}
        autoPlay={!durukKare}
        loop={durukKare ? false : dongu}
        speed={hiz}
        progress={durukKare ? ilerleme : undefined}
        // ANDROID'DE MERGE PATH: lottie-android bunu VARSAYILAN OLARAK
        // KAPALI tutuyor. Kapalıyken çıkarma/kesişim uygulanmaz ve şekil
        // dolu boyanır — zafer'in kale ağı bu yüzden bembeyaz çıkıyordu
        // (o dosyada 40 merge path var). Açmak doğru çizimi veriyor;
        // Lottie belgeleri karmaşık dosyalarda yavaşlatabileceğini söylüyor,
        // o yüzden ağır dosyalar zaten yalnız tam ekranda çiziliyor.
        enableMergePathsAndroidForKitKatAndAbove
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
