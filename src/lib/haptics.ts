import * as Haptics from "expo-haptics";

/**
 * Dokunsal geri bildirim.
 *
 * KURAL — GEZINMEDE TITRESIM YOK, ISLEMDE VAR.
 *
 * Kullanicinin sikayeti: "gecislere tikladigimda titresim gibi bir sey oluyor
 * ve her yerde boyle". Olculdu: 245 haptik cagrisindan 149'u ti ve
 * bunlarin 47'si SADECE bir ekrana gitmek icindi ().
 * iOS'ta  gercek bir fiziksel darbe; her gezinmede tetiklenince
 * uygulama titrek hissettiriyordu. Sistem uygulamalari gezinmede haptik
 * vermez, yalniz secim degisiminde ve islem sonucunda verir.
 *
 * Bundan sonra:
 *   gezinme (bir ekrani acmak, geri gitmek)  -> HAPTIK YOK
 *   secim degisimi (sekme, filtre, secenek)  -> select
 *   islem (gonder, hediye, takip, katil)     -> light / medium
 *   sonuc (basarili / uyari)                 -> success / warning
 */
export const haptic = {
  select: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};
