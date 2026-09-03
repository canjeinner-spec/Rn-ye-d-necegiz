import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Alt navigasyonun kapladığı yükseklik (güvenli alan HARİÇ).
 *
 * `BottomNav.tsx`ten ölçüldü:
 *   wrap paddingTop 6
 * + kapsül: kenarlık 1×2 + paddingVertical 7×2
 * + sekme: paddingVertical 7×2 + ikon ~24 + etiket ~12 + marginTop 4
 * + wrap paddingBottom 12
 * ≈ 88
 */
export const ALT_NAV_YUKSEKLIK = 88;

/**
 * Sekme ekranlarındaki kaydırılabilir içeriğin alt payı.
 *
 * NEDEN VAR: beş sekme ekranı `paddingBottom: 110` ya da `120` yazıyordu —
 * elle tutturulmuş sabitler ve GÜVENLİ ALANI HESABA KATMIYORLARDI. Alt
 * navigasyon `bottom: 0`da duruyor ve kendi payını `12 + insets.bottom` ile
 * alıyor; yani ana ekran çentikli bir telefonda (insets.bottom 34) gereken
 * pay ~122 iken içerik 110'da kalıyordu ve listenin son satırı navigasyonun
 * arkasında görünmüyordu.
 *
 * `ekstra` nefes payı: içerik navigasyona yapışmasın.
 */
export function useIcerikAltPayi(ekstra = 14): number {
  const insets = useSafeAreaInsets();
  return ALT_NAV_YUKSEKLIK + insets.bottom + ekstra;
}
