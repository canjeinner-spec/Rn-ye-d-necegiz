import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Polygon, RadialGradient, Stop } from "react-native-svg";

import { type Gift } from "@/data/gifts";
import { Anim } from "@/components/Anim";
import { sceneFor } from "@/gifts/bigGifts";
import { hediyeSesiCal } from "@/lib/hediyeSesi";
import { Txt } from "@/components/Txt";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const PARTICLES = 16;

function Particle({ i, c }: { i: number; c: string }) {
  const p = useSharedValue(0);
  const angle = (i / PARTICLES) * Math.PI * 2 + (i % 3);
  const dist = 130 + ((i * 37) % 110);
  useEffect(() => {
    p.value = withDelay(220, withTiming(1, { duration: 1100 + (i % 5) * 130, easing: Easing.out(Easing.quad) }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.9,
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value },
      { scale: 1 - 0.5 * p.value },
    ],
  }));
  return <Animated.View style={[styles.particle, { backgroundColor: c }, style]} />;
}

function Ring({ delay, color }: { delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: (1 - p.value) * 0.6, transform: [{ scale: 0.4 + p.value * 1.6 }] }));
  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

export function BigGiftOverlay({ gift, qty, sender, onDone, sure }: {
  gift: Gift; qty: number; sender: string; onDone: () => void;
  /**
   * Ekranda kalma suresi (ms). Verilmezse sahnenin kendi suresi kullanilir.
   * Efekt kuyrugu bunu veriyor: kuyruk uzadikca gosterim kisaliyor, yoksa
   * kalabalik odada sira dakikalarca surer.
   */
  sure?: number;
}) {
  const scene = sceneFor(gift.id);
  // Tam ekran: ağır dosyalar da burada oynar (tek örnek, tam boy).
  const buyukKaynak = scene.anim?.();
  const dim = useSharedValue(0);
  const flash = useSharedValue(0);
  const emblem = useSharedValue(0);
  const beam = useSharedValue(0);
  const bannerY = useSharedValue(46);
  const bannerOp = useSharedValue(0);

  useEffect(() => {
    // Ses isteğe bağlı (bigGifts.ts): dosyası olmayan hediye sessiz oynar.
    // Çalma işi `lib/hediyeSesi`de — Android'de ses odağı ve yükleme
    // beklemesi orada çözülüyor, burada kopyası durmasın.
    const sesiBirak = scene.sound ? hediyeSesiCal(scene.sound) : null;

    dim.value = withTiming(1, { duration: 260 });
    flash.value = withSequence(withTiming(0.85, { duration: 110 }), withTiming(0, { duration: 460 }));
    emblem.value = withDelay(140, withSpring(1, { damping: 8, mass: 0.9, stiffness: 120 }));
    beam.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    bannerOp.value = withDelay(520, withTiming(1, { duration: 320 }));
    bannerY.value = withDelay(520, withSpring(0, { damping: 14 }));

    const t = setTimeout(onDone, sure ?? scene.duration);
    return () => { clearTimeout(t); sesiBirak?.(); };
  }, []);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const beamStyle = useAnimatedStyle(() => ({ opacity: 0.5 * dim.value, transform: [{ rotate: `${beam.value * 360}deg` }] }));
  const emblemStyle = useAnimatedStyle(() => ({
    opacity: emblem.value,
    transform: [{ scale: 0.3 + emblem.value * 0.7 }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({ opacity: bannerOp.value, transform: [{ translateY: bannerY.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, dimStyle]}>
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Gradient colors={[`${gift.c2}55`, "rgba(4,3,8,0.82)"]} deg={180} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        {/* Dönen ışık huzmeleri, halkalar ve kıvılcımlar YALNIZ Lottie'si
            OLMAYAN hediyelerde. Kullanıcı kararı: "arkasındaki sarımsı
            parlak şeyi kaldır, sadece kendisi olsun animasyonun". Hediyenin
            kendi kompozisyonu varsa bu süsler onun üstüne biniyor ve
            renklerini bozuyordu. Karartma ve alttaki bilgi şeridi kalıyor:
            biri odayı gizliyor, diğeri kimin ne gönderdiğini söylüyor. */}
        {!buyukKaynak && (
        <>
        <Animated.View style={[styles.beamWrap, beamStyle]}>
          <Svg width={460} height={460} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={gift.c1} stopOpacity={0.0} />
                <Stop offset="0.55" stopColor={gift.c1} stopOpacity={0.5} />
                <Stop offset="1" stopColor={gift.c1} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const x = 50 + Math.cos(a) * 60;
              const y = 50 + Math.sin(a) * 60;
              const a2 = a + 0.06;
              const x2 = 50 + Math.cos(a2) * 60;
              const y2 = 50 + Math.sin(a2) * 60;
              return <Polygon key={i} points={`50,50 ${x},${y} ${x2},${y2}`} fill="url(#bg)" />;
            })}
          </Svg>
        </Animated.View>

        <Ring delay={0} color={gift.c1} />
        <Ring delay={460} color={gift.c2} />
        <Ring delay={920} color={gift.c1} />

        {Array.from({ length: PARTICLES }).map((_, i) => (
          <View key={i} style={styles.particleWrap} pointerEvents="none">
            <Particle i={i} c={i % 2 ? gift.c1 : "#FDE68A"} />
          </View>
        ))}
        </>
        )}

        {/* Emblem: çıplak 108px emoji yerine hediyenin renklerinden madalyon */}
        {/* Gölge de süs: hediyenin c1 renginde, yarıçapı 34 ve opaklığı 0.9 —
            zafer'de bu altın sarısı (#FFE647) bir hale demek ve animasyonun
            tam arkasına biniyordu. Kendi Lottie'si olanda kapalı. */}
        <Animated.View style={[styles.emblem, !buyukKaynak && { shadowColor: gift.c1 }, emblemStyle]}>
          {buyukKaynak ? (
            // Hediyenin kendi Lottie'si varsa madalyon YOK — animasyon
            // kendi kompozisyonuyla gelir, halkanın içine hapsetmek onu
            // küçültür ve kenarlarını kırpar.
            <Anim kaynak={buyukKaynak} boyut={300} dongu={false} />
          ) : (
          <Gradient colors={[gift.c1, gift.c2, gift.c1]} deg={135} style={styles.emblemHalka}>
            <View style={styles.emblemIc}>
              <Txt size={92}>{gift.emoji}</Txt>
            </View>
          </Gradient>
          )}
        </Animated.View>
      </View>

      {/* Açıklama: dolu gradyan blok içinde "Sen · Hediye" ve altında ×3
          yazıyordu; kim, ne, kaç tane olduğu tek bakışta okunmuyordu.
          Artık gönderen kendi çipinde, hediye adı ortada, adet rozette. */}
      <Animated.View style={[styles.banner, bannerStyle]} pointerEvents="none">
        <View style={[styles.bannerInner, { borderColor: gift.c1 + "77" }]}>
          <Gradient colors={[gift.c1 + "4D", "rgba(10,9,14,.94)"]} deg={120} style={StyleSheet.absoluteFill} />
          <View style={[styles.gonderen, { borderColor: gift.c1 + "66", backgroundColor: gift.c1 + "24" }]}>
            <Txt weight="extrabold" size={10.5} color={gift.c1} numberOfLines={1}>{sender}</Txt>
          </View>
          <Txt weight="displayBold" size={15} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{gift.name}</Txt>
          <View style={[styles.bannerAdet, { borderColor: gift.c1 + "55" }]}>
            <Txt weight="extrabold" size={13} color={gift.c1}>×{qty}</Txt>
          </View>
        </View>
      </Animated.View>

      {/* Beyaz patlama da süs: kendi animasyonu olan hediyede kapalı. */}
      {!buyukKaynak && <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  beamWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2.5 },
  particleWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  particle: { width: 9, height: 9, borderRadius: 5 },
  emblem: { alignItems: "center", justifyContent: "center", shadowOpacity: 0.9, shadowRadius: 34, shadowOffset: { width: 0, height: 0 } },
  emblemHalka: { width: 190, height: 190, borderRadius: 95, padding: 4 },
  emblemIc: { flex: 1, borderRadius: 95, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,7,12,.86)" },
  banner: { position: "absolute", left: 24, right: 24, bottom: "20%", alignItems: "center" },
  bannerInner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, overflow: "hidden", maxWidth: "100%" },
  gonderen: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, maxWidth: 120 },
  bannerAdet: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, borderWidth: 1, backgroundColor: "rgba(255,255,255,.06)" },
  flash: { backgroundColor: "#fff" },
});
