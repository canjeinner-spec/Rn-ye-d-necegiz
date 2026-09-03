import { StyleSheet } from "react-native";

import { C } from "./colors";
import { Gradient } from "./Gradient";

/**
 * Sayfa zemini — siyah-altın standardı, TEK YERDE.
 *
 * NEDEN VAR: aynı iki satır on küsur ekranda kopyalanmıştı ve sekiz ekran da
 * kendi tonunu uydurmuştu — referral yeşil (#0A2A1E), badges ve about mor
 * (#1B1430 / #241B3A), updates ve diamond-load turkuaz (#0E2A2A / #0C1E22),
 * level kahve (#241B0A), RoomStats mavi, ContributionView kahve. Tema
 * siyah-altın; bu tonların hiçbirinin karşılığı yok. Ekranlar arasında
 * gezerken zemin rengi değişiyordu.
 *
 * `about` ve `updates` ayrıca kök zeminlerinde de farklı siyah kullanıyordu
 * (#0B0712, #0A0F14) — gradyan bitince altından o çıkıyordu.
 *
 * Kopyayı bitirmek asıl mesele: renkler tek yerde olmadıkça bir sonraki
 * ekran yine kendi tonunu uydurur.
 */
export function Zemin({ hale = true }: { hale?: boolean }) {
  return (
    <>
      <Gradient
        colors={["#16121F", "#0B0A11", "#08080C"]}
        deg={175}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Üstteki altın hale — markanın imzası. Kapatılabilir olması, zemini
          kendi başlığıyla boyayan ekranlar (ör. profil kapağı) için. */}
      {hale && (
        <Gradient
          colors={[C.gold + "1A", "transparent"]}
          deg={180}
          style={styles.hale}
          pointerEvents="none"
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hale: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
});
