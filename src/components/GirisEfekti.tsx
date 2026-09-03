import { useEffect, useRef, useState } from "react";
import { type DimensionValue, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { GIRIS_TEMALARI } from "@/data/esyaTemalari";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Txt } from "./Txt";

/** Açıldıktan sonra ekranda kalma süresi. */
const ACIK_MS = 2000;
/** Kapalıyken genişlik — yalnızca ikon madalyonu kadar. */
const KAPALI_G = 38;
const ACILMA_MS = 460;
const KAPANMA_MS = 340;

function Parca({ renk, sol, gecikme, sure }: { renk: string; sol: DimensionValue; gecikme: number; sure: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(gecikme, withRepeat(withTiming(1, { duration: sure, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, gecikme, sure]);
  const stil = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 - t.value * 16 }, { scale: 1 - t.value * 0.6 }],
    opacity: (1 - t.value) * 0.85,
  }));
  const temel: ViewStyle = { position: "absolute", bottom: 4, left: sol, width: 3, height: 3, borderRadius: 1.5, backgroundColor: renk };
  return <Animated.View pointerEvents="none" style={[temel, stil]} />;
}

/**
 * Odaya giriş efekti (056: `giris` tipi eşya).
 *
 * Yerleşim: mikrofon ızgarasının hemen altında, sohbetin başladığı yerde —
 * yani sistem mesajının olduğu hizada. Ekranın tepesinde tam genişlikte bir
 * şeritti; hem odanın çok üstünde kalıyor hem de sahneyi kapatıyordu.
 *
 * Animasyon: ikon madalyonu kadar bir haptan başlar, SAĞA DOĞRU açılıp adı ve
 * cümleyi gösterir, birkaç saniye sonra yine sola toplanıp kaybolur. Genişlik
 * içeriğe göre ölçülüyor (uzun adlar da tam sığar).
 */
export function GirisEfekti({
  ad,
  tema,
  onBitti,
  onBas,
}: {
  ad: string;
  /** null → efekti olmayan kullanıcı: sade "giriş yaptı" bildirimi. */
  tema: string | null;
  onBitti: () => void;
  /** Hapa dokununca — giren kişinin kartını açar. */
  onBas?: () => void;
}) {
  // Efekti olmayan kullanıcı da aynı yerden duyurulur; sade sürüm gradyansız,
  // parçacıksız ve daha kısa kalır — odaya giren herkes görünsün ama sahip
  // olanın efekti öne çıksın.
  const t = tema ? (GIRIS_TEMALARI[tema] ?? GIRIS_TEMALARI.yildiz) : null;
  const acikKalma = t ? ACIK_MS : ACIK_MS - 700;

  // İçerik doğal genişliğinden ölçülür (mutlak konumlu olduğu için haptaki
  // animasyonlu genişlik onu sıkıştırmaz).
  const [hedef, setHedef] = useState<number | null>(null);
  const g = useSharedValue(KAPALI_G);
  const opak = useSharedValue(0);

  /**
   * `onBitti` REF üzerinden — KUYRUĞUN HİÇ BOŞALMAMASININ SEBEBİ BUYDU.
   *
   * Çağıran taraf inline arrow geçiyor (`onBitti={() => setGirisKuyrugu(...)}`),
   * yani oda ekranı her render olduğunda `onBitti` YENİ bir fonksiyon.
   * Aşağıdaki effect'in bağımlılığında olduğu için her render'da temizlik
   * koşuyor ve `clearTimeout(bitir)` zamanlayıcıyı SIFIRLIYORDU. Oda ekranı
   * presence sync, mesaj ve yoklamalarla saniyede birkaç kez render olduğu
   * için 2,4 saniyelik sayaç hiç dolmuyordu: `onBitti` hiç ateşlenmiyor,
   * kuyruk hiç boşalmıyordu.
   *
   * Sonuç: kuyruğun sıfırıncı elemanı (kendi mount efektim) sonsuza kadar
   * ekranda; karşı tarafın yayını birinci sıraya girip orada kalıyordu.
   * "Kendi efektimi görüyorum, karşı taraf görmüyor" tam olarak buydu.
   */
  const onBittiRef = useRef(onBitti);
  onBittiRef.current = onBitti;

  useEffect(() => {
    opak.value = withTiming(1, { duration: 200 });
  }, [opak]);

  /**
   * KUYRUĞU İLERLETME — LAYOUT'A BAĞLI DEĞİL, mount'ta bir kez kurulur.
   *
   * İkinci kök sebep (Metro logu: iki turda da "kuyruga eklendi, onceki
   * uzunluk=1" var ama "efekt bitti" HİÇ yok): bitiş zamanlayıcısı `hedef`
   * ölçümünün geldiği effect'in içindeydi. `hedef` `onLayout`tan geliyor;
   * ölçüm hiç gelmezse zamanlayıcı hiç kurulmuyor, ölçüm değişip durursa
   * sürekli sıfırlanıyor. Kuyruğu ilerletmek bir ölçüm callback'ine
   * bağlanamaz — ölçüm olmasa bile bu eleman ~2,4 sn sonra sıradan
   * çıkmak ZORUNDA, yoksa arkasındaki hiçbir şey görünmüyor.
   *
   * Her kuyruk elemanı `key` ile ayrı örnek olduğu için bu effect eleman
   * başına tam bir kez çalışır.
   */
  useEffect(() => {
    const bitir = setTimeout(() => onBittiRef.current(), acikKalma + KAPANMA_MS + 60);
    return () => clearTimeout(bitir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Açılma/kapanma animasyonu — bu kısım ölçüme bağlı kalabilir. */
  useEffect(() => {
    if (hedef == null) return;
    g.value = withTiming(hedef, { duration: ACILMA_MS, easing: Easing.out(Easing.cubic) });

    const kapat = setTimeout(() => {
      g.value = withTiming(KAPALI_G, { duration: KAPANMA_MS, easing: Easing.in(Easing.cubic) });
      opak.value = withDelay(KAPANMA_MS - 140, withTiming(0, { duration: 160 }));
    }, acikKalma);

    return () => clearTimeout(kapat);
  }, [hedef, g, opak, acikKalma]);

  const stil = useAnimatedStyle(() => ({ width: g.value, opacity: opak.value }));

  return (
    <Animated.View
      style={[
        styles.hap,
        t ? { borderColor: t.parca + "3D" } : { borderColor: "rgba(255,255,255,.10)", backgroundColor: "rgba(16,15,22,.92)" },
        stil,
      ]}
    >
      {t && <Gradient colors={[t.g1, t.g2]} deg={100} style={StyleSheet.absoluteFill} pointerEvents="none" />}

      {/* Hap dokunulabilir: girenin kartını açar. */}
      <Pressable onPress={onBas} style={StyleSheet.absoluteFill} />

      <View
        pointerEvents="none"
        style={styles.icerik}
        onLayout={(e) => setHedef(Math.ceil(e.nativeEvent.layout.width))}
      >
        <View
          style={[
            styles.ikon,
            t
              ? { borderColor: t.parca + "66", backgroundColor: t.parca + "24" }
              : { borderColor: "rgba(255,255,255,.12)", backgroundColor: C.kontrol },
          ]}
        >
          <Icon name={t ? t.ikon : "door"} size={14} color={t ? t.parca : C.dim} />
        </View>
        {t ? (
          <Txt weight="extrabold" size={11.5} color="#fff" numberOfLines={1}>
            {ad} <Txt weight="semibold" size={11} color={t.parca}>{t.cumle}</Txt>
          </Txt>
        ) : (
          // Sade bildirim: yalnızca kullanıcı adı renkli, gerisi soluk.
          <Txt weight="semibold" size={11} color={C.dim} numberOfLines={1}>
            <Txt weight="extrabold" size={11.5} color={C.gold2}>{ad}</Txt> giriş yaptı
          </Txt>
        )}
      </View>

      {t &&
        Array.from({ length: Math.min(t.adet, 7) }, (_, i) => (
          <Parca
            key={i}
            renk={t.parca}
            sol={26 + ((i * 23) % 120)}
            gecikme={(i * 150) % 800}
            sure={700 + ((i * 190) % 600)}
          />
        ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hap: {
    position: "absolute",
    left: 14,
    top: 2,
    zIndex: 30,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  // Mutlak konum: hapın animasyonlu genişliği içeriği sıkıştırmasın, doğal
  // genişliği ölçülebilsin.
  icerik: { position: "absolute", left: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 3, paddingRight: 14 },
  ikon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
