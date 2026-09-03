import { StyleSheet, View } from "react-native";

import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Txt } from "./Txt";

/**
 * "Bu özellik henüz açık değil" notu.
 *
 * NEDEN VAR: iki ekran kullanıcıya AÇIKÇA YALAN söylüyordu. `diamond-load`
 * düğmeye basınca "Satın alma başarılı! N elmas hesabına eklendi" diyordu;
 * `withdraw` "Çekim tamamlandı, $X karşılığı N elmas gönderildi" diyordu.
 * İkisi de tek satırdan ibaretti: `setDone(true)`. Ne ödeme, ne sunucu, ne
 * bakiye değişikliği.
 *
 * Para söz konusu olduğunda sahte başarı en kötü hata türü: kullanıcı
 * ödediğini ya da parasını çektiğini sanır. Ekranlar SİLİNMEDİ — tasarım
 * Faz 4'te gerçeğe bağlanınca kullanılacak — ama artık doğruyu söylüyorlar.
 *
 * `tur="satir"` ekranın başında ince bir uyarı, `tur="tam"` işlem sonundaki
 * dürüst durum ekranı içindir.
 */
export function YakindaNotu({ metin }: { metin: string }) {
  return (
    <View style={styles.kutu}>
      <View style={{ paddingTop: 1 }}>
        <Icon name="warn" size={14} color={C.gold2} />
      </View>
      <Txt size={11.5} color="rgba(255,255,255,.72)" lh={1.45} style={{ flexShrink: 1 }}>
        {metin}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.gold + "38",
    backgroundColor: C.gold + "12",
  },
});
