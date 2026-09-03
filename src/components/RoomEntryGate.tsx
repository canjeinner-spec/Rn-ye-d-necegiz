import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { amIBannedFromRoom } from "@/data/remote/roomsRepo";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Perdenin en az görünme süresi — kontrol hızlı biterse titremesin. */
const EN_AZ_MS = 900;

function NabizHalka({ size }: { size: number }) {
  const v = useSharedValue(0.9);
  useEffect(() => {
    v.value = withRepeat(withTiming(1.25, { duration: 1300, easing: Easing.out(Easing.ease) }), -1, false);
  }, [v]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: 1 - (v.value - 0.9) / 0.35 }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -8, left: -8, right: -8, bottom: -8, borderRadius: size, borderWidth: 2, borderColor: C.gold }, s]}
    />
  );
}

/**
 * Odaya giriş perdesi — odaya GİRMEDEN ÖNCE, bulunulan ekranın üstünde.
 *
 * Önce oda ekranının içinde duruyordu: uygulama önce odaya giriyor, perde de
 * oda sahnesinin üstünü örtüyordu. Sorun oradaydı — yasaklı olduğun odaya
 * bile önce giriliyor, sonra "yasaklandın" deyip dışarı atılıyordun; odayı
 * küçültüp geri dönmek de perdeyi yeniden tetikliyordu.
 *
 * Artık sıra tersine: perde nerede olursan ol (oda listesi, sıralama, DM…)
 * orada açılır, kontroller burada yapılır, ancak sorun yoksa odaya girilir.
 *   • oda yasağı (022_oda_yasaklari) → giriş yok
 *   • oda yönetim işlemi görmüş (054) → uyarı, kararı kullanıcı verir
 *   • bağlantı kurulamıyor → hata + "Tekrar dene"
 */
export function RoomEntryGate({ room, onDevam, onVazgec }: {
  room: Room;
  /** Kontroller geçti ya da kullanıcı riski kabul etti → odaya gir. */
  onDevam: () => void;
  /** Vazgeçildi / girilemedi → perde kapanır, odaya girilmez. */
  onVazgec: () => void;
}) {
  const [asama, setAsama] = useState<"kontrol" | "uyari" | "hata">("kontrol");
  const [hata, setHata] = useState<{ metin: string; tekrar: boolean }>({ metin: "", tekrar: false });
  const [deneme, setDeneme] = useState(0);

  // Callback'ler her render'da yeni referans olabilir; effect'i tetiklememeleri
  // için ref'te tutuluyor (yoksa kontrol sonsuz döngüye girerdi).
  const devamRef = useRef(onDevam);
  devamRef.current = onDevam;

  useEffect(() => {
    let alive = true;
    setAsama("kontrol");
    const basladi = Date.now();

    (async () => {
      let sonuc: { tip: "ok" } | { tip: "uyari" } | { tip: "hata"; metin: string; tekrar: boolean };
      try {
        // Sahip kendi odasından yasaklanamaz; sorgu boşuna, üstelik hata
        // verirse odanın sahibini kendi odasından uzak tutardı.
        if (!room.owner && room.dbId != null && isSupabaseConfigured && (await amIBannedFromRoom(room.dbId))) {
          sonuc = { tip: "hata", metin: "Bu odadan yasaklandın, giriş yapamazsın.", tekrar: false };
        } else if (room.islemGordu) {
          sonuc = { tip: "uyari" };
        } else {
          sonuc = { tip: "ok" };
        }
      } catch {
        sonuc = { tip: "hata", metin: "Odaya bağlanılamadı. Bağlantını kontrol edip tekrar dene.", tekrar: true };
      }

      // Kontrol 50 ms'de bitse bile perde bir an görünüp kaybolmasın.
      const kalan = EN_AZ_MS - (Date.now() - basladi);
      if (kalan > 0) await new Promise((r) => setTimeout(r, kalan));
      if (!alive) return;

      if (sonuc.tip === "ok") { devamRef.current(); return; }
      haptic.warning();
      if (sonuc.tip === "uyari") setAsama("uyari");
      else { setHata({ metin: sonuc.metin, tekrar: sonuc.tekrar }); setAsama("hata"); }
    })();

    return () => { alive = false; };
  }, [room.dbId, room.islemGordu, deneme]);

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={styles.perde}>
      {/* Bulunulan ekranın üstünde duruyor: bulanıklık + karartma. Oda sahnesi
          arkada DEĞİL — odaya henüz girilmedi. */}
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable style={StyleSheet.absoluteFill} onPress={asama === "kontrol" ? undefined : onVazgec}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,8,12,.66)" }]} />
      </Pressable>

      {asama === "kontrol" && (
        <View style={{ alignItems: "center", paddingHorizontal: 34 }} pointerEvents="none">
          <View>
            <NabizHalka size={80} />
            <View style={styles.kapak}>
              <Portrait name={room.name} size={80} photo={room.photo} ring={C.gold} glow />
            </View>
          </View>
          <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 22 }} numberOfLines={1}>
            {room.name}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 }}>
            <ActivityIndicator size="small" color={C.gold} />
            <Txt weight="semibold" size={13} color={C.dim}>Odaya giriliyor…</Txt>
          </View>
        </View>
      )}

      {asama === "uyari" && (
        <View style={styles.kart}>
          <View style={[styles.kartIkon, { backgroundColor: "rgba(251,113,133,.14)", borderColor: "rgba(251,113,133,.34)" }]}>
            <Icon name="warn" size={26} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 14 }}>
            {room.owner ? "Odana işlem yapıldı" : "Bu odaya işlem yapıldı"}
          </Txt>
          <Txt size={12.5} color={C.dim} lh={1.6} align="center" style={{ marginTop: 10 }}>
            {room.owner
              ? "Odan kurallar gereği yönetim işlemi gördü. İşlem kalkana kadar oda ayarlarını değiştiremezsin ve odan listelerde görünmez."
              : "Bu oda kurallar gereği yönetim işlemi görmüştür. Yine de girer ve hemen ayrılmazsan hesabın da cezai işlem görebilir."}
          </Txt>
          {!!room.islemSebep && (
            <View style={styles.sebepKutu}>
              <Txt weight="bold" size={10} color={C.dim2} style={{ letterSpacing: 0.4 }}>SEBEP</Txt>
              <Txt size={12} color={C.text} lh={1.5} style={{ marginTop: 4 }}>{room.islemSebep}</Txt>
            </View>
          )}

          {/* Sahibi için "vazgeç" öne çıkmaz: kendi odası, girmesi normal.
              Ziyaretçide ise güvenli olan (girmemek) altın düğme. */}
          <Pressable
            onPress={() => { haptic.light(); room.owner ? onDevam() : onVazgec(); }}
            style={styles.anaBtnSarma}
          >
            <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.btn}>
              <Icon name="door" size={16} color="#241A05" />
              <Txt weight="extrabold" size={13.5} color="#241A05">{room.owner ? "Odama gir" : "Vazgeç"}</Txt>
            </Gradient>
          </Pressable>
          <Pressable
            onPress={() => { haptic.light(); room.owner ? onVazgec() : onDevam(); }}
            style={[styles.btn, styles.ikinciBtn]}
          >
            <Txt weight="bold" size={12.5} color={C.dim}>{room.owner ? "Vazgeç" : "Riski kabul ediyorum, gir"}</Txt>
          </Pressable>
        </View>
      )}

      {asama === "hata" && (
        <View style={styles.kart}>
          <View style={[styles.kartIkon, { backgroundColor: "rgba(248,113,113,.14)", borderColor: "rgba(248,113,113,.34)" }]}>
            <Icon name={hata.tekrar ? "globe2" : "ban"} size={26} color={C.red} />
          </View>
          <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 14 }} numberOfLines={1}>
            {room.name}
          </Txt>
          <Txt size={12.5} color={C.dim} lh={1.6} align="center" style={{ marginTop: 10 }}>
            {hata.metin}
          </Txt>

          {hata.tekrar && (
            <Pressable onPress={() => { haptic.light(); setDeneme((d) => d + 1); }} style={styles.anaBtnSarma}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.btn}>
                <Txt weight="extrabold" size={13.5} color="#241A05">Tekrar dene</Txt>
              </Gradient>
            </Pressable>
          )}
          <Pressable onPress={() => { haptic.light(); onVazgec(); }} style={[styles.btn, hata.tekrar ? styles.ikinciBtn : styles.tekBtn]}>
            <Txt weight="bold" size={12.5} color={hata.tekrar ? C.dim : C.text}>Kapat</Txt>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  perde: { ...StyleSheet.absoluteFillObject, zIndex: 60, alignItems: "center", justifyContent: "center" },
  kapak: { borderRadius: 40, overflow: "hidden" },
  kart: {
    marginHorizontal: 26,
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: "rgba(18,17,26,.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  kartIkon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sebepKutu: { alignSelf: "stretch", marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  anaBtnSarma: { alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 15 },
  ikinciBtn: { alignSelf: "stretch", marginTop: 8 },
  tekBtn: { alignSelf: "stretch", marginTop: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.14)", backgroundColor: C.kontrol },
});
