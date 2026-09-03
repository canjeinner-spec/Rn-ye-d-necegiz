import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { YakindaNotu } from "@/components/YakindaNotu";
import { VipEmblem } from "@/components/VipEmblem";
import { VIP_PERKS, VIP_TIERS, type VipTierKey } from "@/data/vip";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const KEYS: VipTierKey[] = ["asil", "hukumdar"];

/**
 * Aron VIP.
 *
 * Eski hâlinde sayfa dağınıktı: zemin kademeye göre mor/kahve oluyordu
 * (temanın dışı), kademe sekmeleri elle çizilmişti, amblem-isim-fiyat üç ayrı
 * yerdeydi, ayrıcalıklar kartsız serbest ikonlardı ve kilit rozeti
 * `right:"50%" marginRight:-22` gibi bir hesapla tutturulmuştu.
 *
 * Yeni düzen: siyah-altın zemin + kademe tonunda hale, tek bir "kademe kartı"
 * (amblem + ad + fiyat + aylık elmas), ortak sekme çubuğu ve kart hâline
 * getirilmiş ayrıcalık ızgarası.
 */
export default function VipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tier, setTier] = useState<VipTierKey>("hukumdar");
  const t = VIP_TIERS[tier];
  const acik = VIP_PERKS.filter((_, i) => i < t.count).length;

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {/* Hale kademenin tonunda — zeminin tamamı değişmiyor, yalnız tepesi */}
      <Gradient colors={[t.color + "2E", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">
              Aron <Txt weight="displayBold" size={16} color={C.gold}>VIP</Txt>
            </Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <Tabs items={[VIP_TIERS.asil.name, VIP_TIERS.hukumdar.name]} active={KEYS.indexOf(tier)} set={(i: number) => setTier(KEYS[i])} fill pad={16} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          {/* ---- Kademe kartı: amblem, ad, fiyat, aylık elmas tek yerde ---- */}
          <View style={[styles.kart, { borderColor: t.color + "4D" }]}>
            <Gradient colors={[t.color + "24", t.color + "08", "transparent"]} deg={165} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.kartParilti} pointerEvents="none" />
            <View style={[styles.kartIsik, { backgroundColor: t.color + "1F", shadowColor: t.color }]} pointerEvents="none" />

            <VipEmblem tier={tier} s={124} />
            <Txt weight="displayBold" size={23} color="#fff" style={{ marginTop: 2, letterSpacing: 0.5 }}>{t.name}</Txt>

            <View style={styles.fiyatSerit}>
              <View style={styles.fiyatKol}>
                <Txt weight="displayBold" size={17} color={t.color}>{t.price}</Txt>
                <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 3, letterSpacing: 0.3 }}>AYLIK</Txt>
              </View>
              <View style={styles.fiyatAyirici} />
              <View style={styles.fiyatKol}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <DiamondBadge size={15} />
                  <Txt weight="displayBold" size={17} color="#fff">{t.monthly.toLocaleString("tr-TR")}</Txt>
                </View>
                <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 3, letterSpacing: 0.3 }}>HER AY ELMAS</Txt>
              </View>
              <View style={styles.fiyatAyirici} />
              <View style={styles.fiyatKol}>
                <Txt weight="displayBold" size={17} color="#fff">{t.count}<Txt weight="bold" size={11} color={C.dim2}>/{VIP_PERKS.length}</Txt></Txt>
                <Txt weight="semibold" size={9} color={C.dim2} style={{ marginTop: 3, letterSpacing: 0.3 }}>AYRICALIK</Txt>
              </View>
            </View>
          </View>

          {/* ---- Durum ---- */}
          <View style={styles.durum}>
            <Icon name="shield" size={14} color={C.dim} />
            <Txt weight="semibold" size={11.5} color={C.dim} style={{ flex: 1 }}>Henüz Aron VIP üyesi değilsin.</Txt>
          </View>

          {/* ---- Ayrıcalıklar ---- */}
          <View style={styles.bolum}>
            <Icon name="crown" size={14} color={t.color} />
            <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>AYRICALIKLAR</Txt>
            <View style={{ flex: 1 }} />
            <Txt weight="bold" size={10} color={t.color}>{acik} açık</Txt>
          </View>

          <View style={styles.izgara}>
            {VIP_PERKS.map((p, i) => {
              const kilitli = i >= t.count;
              return (
                <View key={p.t} style={[styles.perk, kilitli && styles.perkKilitli]}>
                  <View style={[styles.perkIkon, { backgroundColor: kilitli ? "rgba(255,255,255,.05)" : t.color + "1A", borderColor: kilitli ? "rgba(255,255,255,.08)" : t.color + "44" }]}>
                    <Icon path={p.d} size={22} sw={1.7} color={kilitli ? C.dim2 : t.color} />
                  </View>
                  <Txt weight="extrabold" size={12} color={kilitli ? C.dim : C.text} align="center" style={{ marginTop: 9 }} numberOfLines={1}>{p.t}</Txt>
                  <Txt size={9.5} color={C.dim2} align="center" lh={1.4} style={{ marginTop: 3 }} numberOfLines={2}>{p.s}</Txt>

                  {/* Kilit, kartın kendi köşesinde — eskiden yüzde hesabıyla
                      ortaya tutturulmuş, kaymış duruyordu. */}
                  {kilitli && (
                    <View style={styles.kilit}>
                      <Icon name="lock" size={9} color={C.dim2} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* ---- Abonelik ---- */}
        <View style={[styles.altBar, { paddingBottom: 10 + insets.bottom }]}>
          {/* DÜĞME HİÇBİR ŞEY YAPMIYORDU — `onPress` yalnız titretiyordu.
              Sahte başarı kadar bariz değil ama aynı türden: kullanıcı abone
              olduğunu sanabilir ya da uygulamanın bozuk olduğunu düşünür.
              VIP satın alma gerçek ödemeye bağlı (Faz 4.12); o gelene kadar
              düğme sönük ve durum açıkça yazıyor. */}
          <YakindaNotu metin="VIP abonelik henüz açık değil. Paketler ve ayrıcalıklar önizleme amaçlı; ödeme alınmıyor." />
          <Pressable
            onPress={() => haptic.warning()}
            style={[styles.subBtn, { shadowColor: t.color, opacity: 0.55, marginTop: 12 }]}
          >
            <Gradient colors={t.grad} deg={100} style={styles.subInner}>
              <Icon name="crown" size={17} sw={2} color="#241A05" />
              <Txt weight="extrabold" size={14} color="#241A05">{t.name} ol · {t.price}/ay</Txt>
            </Gradient>
          </Pressable>
          <Txt size={9.5} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 9 }}>
            Abone olarak Kullanım Şartları ve Gizlilik Politikası'nı kabul edersin.
          </Txt>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },

  kart: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: "rgba(18,15,24,.72)",
    overflow: "hidden",
  },
  kartParilti: { position: "absolute", top: 0, left: 34, right: 34, height: 1.5, backgroundColor: "rgba(255,255,255,.30)" },
  kartIsik: {
    position: "absolute", top: -70, alignSelf: "center", width: 220, height: 180, borderRadius: 110,
    shadowOpacity: 0.8, shadowRadius: 40, shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  fiyatSerit: {
    flexDirection: "row", alignItems: "center", alignSelf: "stretch", marginTop: 16,
    borderRadius: 16, backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },
  fiyatKol: { flex: 1, alignItems: "center", paddingVertical: 12 },
  fiyatAyirici: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: "rgba(255,255,255,.12)" },

  durum: {
    flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12,
    paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14,
    backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.08)",
  },

  bolum: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 22, marginBottom: 11 },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  perk: {
    width: "47.6%", flexGrow: 1, alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 18,
    backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.09)",
  },
  perkKilitli: { opacity: 0.55 },
  perkIkon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  kilit: {
    position: "absolute", top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.10)",
  },

  altBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,.10)" },
  subBtn: { borderRadius: 16, overflow: "hidden", shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  subInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
});
