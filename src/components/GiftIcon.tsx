import { Image } from "expo-image";
import { memo } from "react";
import { View } from "react-native";

import { type Gift } from "@/data/gifts";
import { giftPng } from "@/gifts/giftPng";
import { Txt } from "./Txt";

/**
 * Hediye rozeti — SADE ve STATİK. Kapsül yok, Lottie yok.
 *
 * Kapsül (kademe kenarlığı, yarı saydam zemin, radyal gradyan, parlama
 * şeridi, gölge) kullanıcı kararıyla kaldırıldı: hediye kutusu vitrindeki
 * gibi görünsün, görsel doğrudan koyu zeminde dursun.
 *
 * LOTTIE DE KALDIRILDI. Karolar duruk kare çiziyordu ama her biri yine bir
 * native Lottie görünümü ve kompozisyon ağacıydı; altı tanesi aynı anda
 * ekranda olunca ızgara akıcı olmuyordu. Artık `scripts/lottie-png.js` ile
 * aynı dosyalardan üretilmiş PNG'ler kullanılıyor (bkz. `giftPng.ts`).
 * Animasyon yalnız gönderim efektinde oynuyor — kullanıcının istediği bu.
 *
 * PNG'si olmayan hediye emojiye düşer.
 */
export const GiftIcon = memo(function GiftIcon({ gift, size = 54 }: { gift: Gift; size?: number }) {
  const png = giftPng(gift.id);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {png ? (
        <Image source={png} style={{ width: size, height: size }} contentFit="contain" transition={0} />
      ) : (
        // Kapsül gittiği için emoji büyük: 0.46 çıplak zeminde küçük kalıyordu.
        <Txt size={size * 0.74}>{gift.emoji}</Txt>
      )}
    </View>
  );
});
