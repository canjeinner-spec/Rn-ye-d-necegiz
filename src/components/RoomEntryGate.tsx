import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { type Room } from "@/data/seed";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Yükleme perdesinin en az görünme süresi — anlık geçişte titremesin. */
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
 * Odaya giriş perdesi.
 *
 * İki iş yapar:
 *   1) "Odaya giriliyor…" — oda hazırlanırken boş/yarım ekran görünmesin.
 *   2) Oda yönetim işlemi görmüşse (054: odalar.islem_gordu) kullanıcıyı
 *      girmeden önce uyarır. Daha önce böyle bir odaya giren kişi hiçbir
 *      şey görmüyordu; işlem görmüş odada kalmanın riskini bilmiyordu.
 */
export function RoomEntryGate({ room, onDevam, onVazgec }: {
  room: Room;
  onDevam: () => void;
  onVazgec: () => void;
}) {
  const uyariVar = !!room.islemGordu;
  const [asama, setAsama] = useState<"yukleniyor" | "uyari">("yukleniyor");

  useEffect(() => {
    const t = setTimeout(() => {
      if (uyariVar) { haptic.warning(); setAsama("uyari"); }
      else onDevam();
    }, EN_AZ_MS);
    return () => clearTimeout(t);
  }, [uyariVar, onDevam]);

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(220)} style={styles.perde}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {asama === "yukleniyor" ? (
        <View style={{ alignItems: "center", paddingHorizontal: 34 }}>
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
      ) : (
        <View style={styles.uyariKart}>
          <View style={styles.uyariIkon}>
            <Icon name="warn" size={26} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 14 }}>
            Bu odaya işlem yapıldı
          </Txt>
          <Txt size={12.5} color={C.dim} lh={1.6} align="center" style={{ marginTop: 10 }}>
            Bu oda kurallar gereği yönetim işlemi görmüştür. Hemen ayrılmazsanız
            hesabınız da cezai işlem görebilir.
          </Txt>
          {!!room.islemSebep && (
            <View style={styles.sebepKutu}>
              <Txt weight="bold" size={10} color={C.dim2} style={{ letterSpacing: 0.4 }}>SEBEP</Txt>
              <Txt size={12} color={C.text} lh={1.5} style={{ marginTop: 4 }}>{room.islemSebep}</Txt>
            </View>
          )}

          <Pressable onPress={() => { haptic.light(); onVazgec(); }} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.btn}>
              <Icon name="door" size={16} color="#241A05" />
              <Txt weight="extrabold" size={13.5} color="#241A05">Odadan Ayrıl</Txt>
            </Gradient>
          </Pressable>
          <Pressable onPress={() => { haptic.light(); onDevam(); }} style={[styles.btn, styles.riskBtn]}>
            <Txt weight="bold" size={12.5} color={C.dim}>Riski kabul ediyorum, devam et</Txt>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  perde: { ...StyleSheet.absoluteFillObject, zIndex: 50, alignItems: "center", justifyContent: "center" },
  kapak: { borderRadius: 40, overflow: "hidden" },
  uyariKart: {
    marginHorizontal: 26,
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: "rgba(20,17,26,.96)",
    borderWidth: 1.5,
    borderColor: "rgba(251,113,133,.34)",
  },
  uyariIkon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.14)", borderWidth: 1, borderColor: "rgba(251,113,133,.34)" },
  sebepKutu: { alignSelf: "stretch", marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 15 },
  riskBtn: { alignSelf: "stretch", marginTop: 8 },
});
