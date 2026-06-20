import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";

import { Txt } from "@/components/Txt";
import { EVENT_BANNERS, type EventBanner } from "@/data/banners";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const { width: SCREEN } = Dimensions.get("window");

function Banner({ b, onPress }: { b: EventBanner; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: SCREEN, paddingHorizontal: 14 }}>
      <View style={styles.banner}>
        <Gradient colors={[b.c1, b.c2]} deg={120} style={StyleSheet.absoluteFill} />
        <Gradient colors={["rgba(255,255,255,.28)", "rgba(255,255,255,0)"]} deg={155} locations={[0, 0.6]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt size={16}>✦</Txt>
          <Txt weight="displayBold" size={18} color={b.accent} align="center" style={styles.title}>{b.title}</Txt>
          <Txt size={16}>✦</Txt>
        </View>
        <Txt weight="bold" size={10} color="rgba(255,255,255,.92)" align="center" style={{ marginTop: 6 }}>{b.date}</Txt>
      </View>
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
          <Banner b={item} onPress={() => { haptic.light(); router.navigate(`/event?id=${item.id}`); }} />
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
  title: { textShadowColor: "rgba(0,0,0,.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 9 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.22)" },
  dotActive: { width: 16, backgroundColor: C.gold },
});
