import * as Haptics from "expo-haptics";

/**
 * Dokunsal geri bildirim.
 *
 * KURAL — GEZINMEDE TITRESIM YOK, ISLEMDE VAR.
 *
 * Kullanıcının şikâyeti: "geçişlere tıkladığımda titreşim gibi bir şey oluyor
 * ve her yerde böyle". Tahmin edilmedi, sayıldı: 245 haptik çağrısından 149'u
 * "light"tı ve bunların 47'si SADECE bir ekranı açmak içindi (haptic.light()
 * hemen ardından router.navigate). iOS'ta impactAsync gerçek bir fiziksel
 * darbe; her gezinmede tetiklenince uygulama titrek hissettiriyordu. Sistem
 * uygulamaları gezinmede haptik vermez — yalnız seçim değişiminde ve işlem
 * sonucunda verir.
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
