import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Txt } from "@/components/Txt";
import { deleteBanner, listBanners, type Banner, type BannerSablon } from "@/data/remote/announceRepo";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { adminStyles as s } from "@/lib/adminMsgStyles";

const SABLON_AD: Record<BannerSablon, string> = { duyuru: "DUYURU", bakim: "BAKIM", etkinlik: "ETKİNLİK" };
const SABLON_IC = { duyuru: "mega", bakim: "gear", etkinlik: "gift" } as const;

export default function AdminBanner() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    listBanners().then(setBanners).catch((e) => console.warn("[banner]", e?.message || e));
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const removeBanner = async (id: number) => {
    haptic.light();
    setBanners((xs) => xs.filter((x) => x.id !== id));
    try { await deleteBanner(id); } catch { reload(); }
  };

  return (
    <View style={s.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="ticket" size={17} color={C.gold} /><Txt weight="displayBold" size={16} color="#fff">Banner Yönetimi</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.navigate("/admin-banner-edit")} style={s.addBtn}>
            <Icon name="plus" size={14} sw={2.5} color={C.gold2} /><Txt weight="extrabold" size={12.5} color={C.gold2}>Yeni Banner (şablon seç)</Txt>
          </Pressable>

          <Txt weight="bold" size={10.5} color={C.dim} style={s.lbl}>MEVCUT BANNER'LAR ({banners.length})</Txt>
          {banners.length === 0 ? (
            <View style={s.empty}><Icon name="ticket" size={16} color={C.dim2} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Henüz banner yok. Yukarıdan ekle.</Txt></View>
          ) : (
            <View style={s.group}>
              {banners.map((b, i) => (
                <View key={b.id}>
                  {i > 0 && <View style={s.divider} />}
                  <Pressable onPress={() => router.navigate(`/admin-banner-edit?id=${b.id}`)} style={styles.bannerRow}>
                    <View style={styles.bThumb}>
                      {b.foto ? <Image source={{ uri: b.foto }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /> : <Icon name={SABLON_IC[b.sablon]} size={16} color={C.dim2} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.sablonBadge}><Txt weight="bold" size={8} color={C.gold2} style={{ letterSpacing: 0.5 }}>{SABLON_AD[b.sablon]}</Txt></View>
                      <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1} style={{ marginTop: 3 }}>{b.baslik}</Txt>
                      {!!b.aciklama && <Txt size={10.5} color={C.dim} numberOfLines={1} lh={1.3} style={{ marginTop: 1 }}>{b.aciklama}</Txt>}
                    </View>
                    <Pressable onPress={() => removeBanner(b.id)} hitSlop={8} style={styles.delBtn}>
                      <Icon name="trash" size={13} color="#FB7185" />
                    </Pressable>
                    <Icon name="chev" size={15} color={C.dim2} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  bThumb: { width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(255,255,255,.04)", alignItems: "center", justifyContent: "center" },
  sablonBadge: { alignSelf: "flex-start", paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 5, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  delBtn: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.28)" },
});
