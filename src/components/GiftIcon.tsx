import { memo } from "react";
import { View } from "react-native";

import { type Gift } from "@/data/gifts";
import { kucukKaynak } from "@/gifts/bigGifts";
import { Anim } from "./Anim";
import { Txt } from "./Txt";

/**
 * Hediye rozeti — SADE. Kapsül yok.
 *
 * Eskiden görselin etrafında yuvarlak bir kapsül vardı: kademe renginde
 * kenarlık, yarı saydam zemin, radyal gradyan, parlama şeridi ve gölge.
 * Kullanıcı kararı: hediye kutusu vitrindeki gibi görünsün — görsel
 * doğrudan koyu zeminin üstünde dursun, çerçeveye hapsedilmesin.
 * Referans olarak rakip uygulamanın hediye kutusu verildi; orada da
 * karolar çıplak, seçim vurgusu KARONUN kendisinde (bkz. GiftSheet).
 *
 * Kademe rengi böylece burada değil, seçili karonun zemininde ve fiyat
 * satırında yaşıyor.
 *
 * `oynat` yalnız seçili hediye için true: kalanlar tek kare (`ilerleme`),
 * yoksa ızgaradaki her karo kendi çizim döngüsünü çalıştırır.
 * Ağır dosyalarda `kucukKaynak` zaten undefined döner, emojiye düşer.
 */
// MEMO: ızgarada tek dokunuş yalnız iki karoyu değiştirmeli (bırakılan ve
// seçilen), altı Lottie görünümünü birden değil. Bunun işe yaraması için
// `gift` nesnesinin de KARARLI olması gerekiyor — bkz. GiftSheet'teki
// `karolar` memo'su; orada her render yeni nesne üretiliyordu.
export const GiftIcon = memo(function GiftIcon({ gift, size = 54, oynat = false }: { gift: Gift; size?: number; oynat?: boolean }) {
  const kaynak = kucukKaynak(gift.id);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {kaynak ? (
        <Anim kaynak={kaynak} boyut={size} ilerleme={oynat ? undefined : 0.5} />
      ) : (
        // Kapsül gittiği için emoji büyüdü: 0.46 çıplak zeminde küçük kalıyordu.
        <Txt size={size * 0.74}>{gift.emoji}</Txt>
      )}
    </View>
  );
});
