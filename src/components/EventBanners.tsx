import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";

import { AronMark } from "@/components/AronMark";
import { Txt } from "@/components/Txt";
import { EVENT_BANNERS, type EventBanner } from "@/data/banners";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const { width: SCREEN } = Dimensions.get("window");

/** Bilgilendirme banner'ı (Biz Kimiz? / Gelecek Güncelleme) — emblem + parıltı, premium görünüm */
function InfoBanner({ b }: { b: EventBanner }) {
  const tag = b.kind === "update" ? "YAKINDA" : "HİKÂYE";
  return (
    <View style={styles.banner}>
      <Gradient colors={[b.c1, b.c2]} deg={125} style={StyleSheet.absoluteFill} />
      {/* köşe parıltısı (accent rengine göre) */}
      <View style={[styles.glow, { backgroundColor: b.accent + "26" }]} pointerEvents="none" />
      {/* üst parlaklık */}
      <Gradient colors={["rgba(255,255,255,.14)", "rgba(255,255,255,0)"]} deg={150} locations={[0, 0.55]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16 }}>
        {b.kind === "update" ? (
          <View style={styles.emblem}>
            <Gradient colors={[b.accent, b.accent + "55"]} deg={150} style={StyleSheet.absoluteFill} />
            <Icon name="evStar" size={26} color="#08201C" />
          </View>
        ) : (
          <AronMark s={54} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Txt weight="bold" size={9} color={b.accent} style={{ letterSpacing: 2 }}>ARON CHAT</Txt>
            <View style={[styles.tag, { backgroundColor: b.accent }]}>
              <Txt weight="extrabold" size={7.5} color="#0B1014" style={{ letterSpacing: 0.5 }}>{tag}</Txt>
            </View>
          </View>
          <Txt weight="displayBold" size={19} color="#fff" style={{ marginTop: 3 }}>{b.title}</Txt>
          <Txt weight="semibold" size={10.5} color="rgba(255,255,255,.8)" style={{ marginTop: 2 }}>{b.subtitle} →</Txt>
        </View>
      </View>
    </View>
  );
}

function Banner({ b, onPress }: { b: EventBanner; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: SCREEN, paddingHorizontal: 14 }}>
      {b.kind === "about" || b.kind === "update" ? (
        <InfoBanner b={b} />
      ) : (
        <View style={styles.banner}>
          {b.image ? (
            <>
              <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Gradient colors={["rgba(8,8,12,.15)", "rgba(8,8,12,.72)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </>
          ) : (
            <>
              <Gradient colors={[b.c1, b.c2]} deg={120} style={StyleSheet.absoluteFill} />
              <Gradient colors={["rgba(255,255,255,.28)", "rgba(255,255,255,0)"]} deg={155} locations={[0, 0.6]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Txt size={16}>✦</Txt>
            <Txt weight="displayBold" size={18} color={b.accent} align="center" style={styles.title}>{b.title}</Txt>
            <Txt size={16}>✦</Txt>
          </View>
          {!!b.date && <Txt weight="bold" size={10} color="rgba(255,255,255,.92)" align="center" style={{ marginTop: 6 }}>{b.date}</Txt>}
        </View>
      )}
    </Pressable>
  );
}

export function EventBanners() {
  const router = useRouter();
  const ref = useRef<FlatList<EventBanner>>(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      const n = (idxRef.current + 1) % EVENT_BANNERS.length;
      idxRef.current = n;
      setIdx(n);
      ref.current?.scrollToOffset({ offset: n * SCREEN, animated: true });
    }, 3800);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ paddingTop: 10 }}>
      <FlatList
        ref={ref}
        data={EVENT_BANNERS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(b) => b.id}
        getItemLayout={(_, i) => ({ length: SCREEN, offset: SCREEN * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN);
          idxRef.current = i;
          setIdx(i);
        }}
        renderItem={({ item }) => (
          <Banner b={item} onPress={() => { haptic.light(); router.navigate((item.route ?? `/event?id=${item.id}`) as never); }} />
        )}
      />
      <View style={styles.dots}>
        {EVENT_BANNERS.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 92, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  glow: { position: "absolute", right: -28, top: -34, width: 150, height: 150, borderRadius: 75 },
  emblem: { width: 54, height: 54, borderRadius: 17, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  tag: { paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 5 },
  title: { textShadowColor: "rgba(0,0,0,.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.22)" },
  dotActive: { width: 16, backgroundColor: C.gold },
});
