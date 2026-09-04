import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";

import { AronMark } from "@/components/AronMark";
import { Txt } from "@/components/Txt";
import { EVENT_BANNERS, type EventBanner } from "@/data/banners";
import { listBanners, type Banner as DBBanner } from "@/data/remote/announceRepo";
import { useCachedResource } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Icon } from "@/icons/Icon";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const { width: SCREEN } = Dimensions.get("window");

/**
 * Banner en/boy oranı. Tek doğru kaynak: yükleme ekranındaki kırpma
 * (admin-banner-edit) ve buradaki çerçeve aynı oranı kullanmalı — eskiden
 * kırpma 16:9 idi ama çerçeve sabit 118px yükseklikle ~3:1 çiziyordu, bu
 * yüzden yüklenen fotoğrafın alt-üstü kayboluyordu.
 *
 * 5:2 iken banner oda kartlarının yanında fazla iri kalıyordu (390pt ekranda
 * ~145px, kart 62px). 7:2 ile ~103px — liste ile dengeli.
 *
 * Kırpma bu oranla AYNI olduğu için fotoğraf "cover" ile çerçeveyi tam
 * doldurur: ne kırpılır ne de yanlarda boşluk kalır.
 */
export const BANNER_ORAN = 7 / 2;

/** Banner id → paketlenmiş görsel. Verilen banner tam-kaplama görsel olarak basılır. */
const BANNER_IMG: Record<string, number> = {
  guncelleme: require("../../assets/images/update-banner.png"),
};

// Kalıcı olarak gösterilen bilgilendirme banner'ları (uygulama kimliği).
const INFO_BANNERS = EVENT_BANNERS.filter((b) => b.kind === "about" || b.kind === "update");

// DB banner → gösterim tipi (foto varsa tam-kaplama, yoksa gradyan + başlık).
type DisplayBanner = EventBanner & { _detail?: DBBanner };
function toDisplay(b: DBBanner): DisplayBanner {
  return { id: `db-${b.id}`, title: b.baslik, subtitle: b.aciklama, date: "", c1: "#2A2350", c2: "#161029", accent: "#FDE68A", kind: "event", image: b.foto, _detail: b };
}

/** Bilgilendirme banner'ı (Biz Kimiz? / Gelecek Güncelleme) — emblem + parıltı, premium görünüm */
function InfoBanner({ b }: { b: EventBanner }) {
  const tag = b.kind === "update" ? "YAKINDA" : "HİKÂYE";
  return (
    <View style={styles.banner}>
      <Gradient colors={[b.c1, b.c2]} deg={125} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { backgroundColor: b.accent + "26" }]} pointerEvents="none" />
      <Gradient colors={["rgba(255,255,255,.14)", "rgba(255,255,255,0)"]} deg={150} locations={[0, 0.55]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16 }}>
        {b.kind === "update" ? (
          <View style={styles.emblem}>
            <Gradient colors={[b.accent, b.accent + "55"]} deg={150} style={StyleSheet.absoluteFill} />
            <Icon name="evStar" size={30} color="#08201C" />
          </View>
        ) : (
          <AronMark s={62} />
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
  const localImg = BANNER_IMG[b.id];
  /**
   * Fotoğraflı banner'da çerçeve, GÖRSELİN kendi oranını alır.
   *
   * Sabit orandaki bir çerçeveye farklı oranda bir foto koyunca iki kötü
   * seçenek kalıyordu: "cover" alt-üstü kesiyor, "contain" yanlarda boşluk
   * bırakıyordu. Yükleme kırpması 16:9 → 5:2 → 7:2 diye değiştiği için
   * eskiden yüklenmiş her foto bir gün mutlaka uyuşmuyor.
   *
   * Görselin gerçek oranını okuyup çerçeveye veriyoruz: ne kırpılıyor ne
   * boşluk kalıyor. Aşırı uçlar (çok kare / çok ince) sınırlanıyor.
   */
  const [oran, setOran] = useState(BANNER_ORAN);
  const olcu = (w: number, h: number) => {
    if (!w || !h) return;
    setOran(Math.min(4.2, Math.max(2.2, w / h)));
  };

  return (
    <Pressable onPress={onPress} style={{ width: SCREEN, paddingHorizontal: 14 }}>
      {localImg ? (
        <View style={styles.banner}>
          <Image source={localImg} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ) : b.kind === "about" || b.kind === "update" ? (
        <InfoBanner b={b} />
      ) : (
        <View style={[styles.banner, b.image ? { aspectRatio: oran } : null]}>
          {b.image ? (
            <>
              <Image
                source={{ uri: b.image }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={160}
                onLoad={(e) => olcu(e.source?.width ?? 0, e.source?.height ?? 0)}
              />
              <Gradient colors={["rgba(8,8,12,.10)", "rgba(8,8,12,.70)"]} deg={180} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </>
          ) : (
            <>
              <Gradient colors={[b.c1, b.c2]} deg={120} style={StyleSheet.absoluteFill} />
              <Gradient colors={["rgba(255,255,255,.28)", "rgba(255,255,255,0)"]} deg={155} locations={[0, 0.6]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </>
          )}
          <View style={{ paddingHorizontal: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Txt size={16}>✦</Txt>
              <Txt weight="displayBold" size={18} color={b.accent} align="center" style={styles.title} numberOfLines={1}>{b.title}</Txt>
              <Txt size={16}>✦</Txt>
            </View>
            {!!b.subtitle && <Txt weight="semibold" size={11} color="rgba(255,255,255,.9)" align="center" numberOfLines={1} style={{ marginTop: 6 }}>{b.subtitle}</Txt>}
            {!!b.date && <Txt weight="bold" size={10} color="rgba(255,255,255,.92)" align="center" style={{ marginTop: 6 }}>{b.date}</Txt>}
          </View>
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

  const { data: dbBanners } = useCachedResource<DBBanner[]>("banners:list", () => listBanners(), { persist: true, enabled: isSupabaseConfigured });

  // Dinamik banner'lar önce, sonra kalıcı bilgilendirme banner'ları.
  const items = useMemo<DisplayBanner[]>(() => [...(dbBanners ?? []).map(toDisplay), ...INFO_BANNERS], [dbBanners]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => {
      const n = (idxRef.current + 1) % items.length;
      idxRef.current = n;
      setIdx(n);
      ref.current?.scrollToOffset({ offset: n * SCREEN, animated: true });
    }, 3800);
    return () => clearInterval(t);
  }, [items.length]);

  const onPress = (item: DisplayBanner) => {
    if (item._detail) { router.navigate(`/banner-detay?id=${item._detail.id}` as never); return; }
    router.navigate((item.route ?? `/event?id=${item.id}`) as never);
  };

  return (
    <View style={{ paddingTop: 10 }}>
      <FlatList
        ref={ref}
        data={items}
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
        renderItem={({ item }) => <Banner b={item} onPress={() => onPress(item)} />}
      />
      <View style={styles.dots}>
        {items.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: "100%", aspectRatio: BANNER_ORAN, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  glow: { position: "absolute", right: -28, top: -34, width: 150, height: 150, borderRadius: 75 },
  emblem: { width: 62, height: 62, borderRadius: 19, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  tag: { paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 5 },
  title: { textShadowColor: "rgba(0,0,0,.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, flexShrink: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 9, flexWrap: "wrap", paddingHorizontal: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.22)" },
  dotActive: { width: 16, backgroundColor: C.gold },
});
