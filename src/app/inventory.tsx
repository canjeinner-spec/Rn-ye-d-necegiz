import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EsyaOnizleme } from "@/components/EsyaOnizleme";
import { Tabs } from "@/components/Tabs";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import { NADIRLIK } from "@/data/esyaTemalari";
import { cikar, esyalarim, kusan, type EsyaTip, type SahipEsya } from "@/data/remote/esyaRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const SEKMELER: [EsyaTip, string][] = [
  ["cerceve", "Çerçeveler"],
  ["giris", "Giriş Efekti"],
  ["balon", "Sohbet Balonu"],
];

const BOS_METIN: Record<EsyaTip, string> = {
  cerceve: "Henüz çerçeven yok. Mağazadan alabilirsin.",
  giris: "Henüz giriş efektin yok. Odaya girerken herkes görsün.",
  balon: "Henüz sohbet balonun yok. Mesajların öne çıksın.",
};

/** "12 gün kaldı" / "Süresiz" / "Süresi doldu" */
function kalanSure(bitis: number | null): { metin: string; bitti: boolean; suresiz: boolean } {
  if (bitis == null) return { metin: "Süresiz", bitti: false, suresiz: true };
  const fark = bitis - Date.now();
  if (fark <= 0) return { metin: "Süresi doldu", bitti: true, suresiz: false };
  const gun = Math.ceil(fark / 86400000);
  return { metin: gun > 1 ? `${gun} gün kaldı` : "Bugün bitiyor", bitti: false, suresiz: false };
}

/**
 * Eşyalarım — 056'daki gerçek envanter.
 *
 * Eskiden data/inventory.ts sabitini gösteriyor, "Kuşan" yalnızca yerel
 * state'i çeviriyordu: uygulama kapanınca unutuluyor, kuşandığın çerçeve
 * hiçbir yerde görünmüyordu. Artık kuşanma esya_kusan RPC'siyle DB'ye
 * yazılıyor ve odada/profilde gerçekten çiziliyor.
 */
export default function InventoryScreen() {
  const router = useRouter();
  const kusanilanlariYenile = useApp((s) => s.kusanilanlariYenile);

  const [tabIx, setTabIx] = useState(0);
  const [esyalar, setEsyalar] = useState<SahipEsya[] | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);

  const tip = SEKMELER[tabIx][0];

  const yukle = useCallback(async () => {
    if (!isSupabaseConfigured) { setEsyalar([]); return; }
    try {
      setEsyalar(await esyalarim());
    } catch (e) {
      console.warn("[esyalarim]", (e as Error)?.message || e);
      setEsyalar([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const yenile = async () => { setYenileniyor(true); await yukle(); setYenileniyor(false); };

  const degistir = async (e: SahipEsya) => {
    if (islemde) return;
    haptic.light();
    setIslemde(e.id);
    try {
      if (e.kusanildi) await cikar(e.id);
      else await kusan(e.id);
      await yukle();
      // Kendi avatarım/balonum anında değişsin.
      await kusanilanlariYenile();
      haptic.success();
    } catch (err) {
      haptic.warning();
      console.warn("[kusan]", (err as Error)?.message || err);
    } finally {
      setIslemde(null);
    }
  };

  const liste = (esyalar ?? []).filter((e) => e.tip === tip);
  const kusanili = liste.find((e) => e.kusanildi) ?? null;

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1 }}>Eşyalarım</Txt>
          <Pressable onPress={() => { haptic.light(); router.navigate("/store"); }} style={styles.magazaBtn}>
            <Icon name="bank" size={13} color={C.gold2} />
            <Txt weight="bold" size={11.5} color={C.gold2}>Mağaza</Txt>
          </Pressable>
        </View>

        <Tabs items={SEKMELER.map(([, ad]) => ad)} active={tabIx} set={setTabIx} pad={16} />

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} tintColor={C.dim} />}
        >
          {/* Kuşanılı olanı aramak için ızgarayı taramaya gerek kalmasın. */}
          <View style={styles.kusaniliSerit}>
            {kusanili ? (
              <>
                <EsyaOnizleme tip={tip} tema={kusanili.tema} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="bold" size={9.5} color={C.gold2} style={{ letterSpacing: 0.8 }}>KUŞANILI</Txt>
                  <Txt weight="extrabold" size={13.5} color="#fff" numberOfLines={1} style={{ marginTop: 3 }}>{kusanili.ad}</Txt>
                </View>
                <Pressable onPress={() => degistir(kusanili)} disabled={!!islemde} style={styles.cikarBtn}>
                  <Txt weight="bold" size={11.5} color={C.dim}>Çıkar</Txt>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.bosMadalyon}><Icon name="x" size={16} color={C.dim2} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="bold" size={9.5} color={C.dim2} style={{ letterSpacing: 0.8 }}>KUŞANILI</Txt>
                  <Txt weight="semibold" size={12.5} color={C.dim} numberOfLines={1} style={{ marginTop: 3 }}>
                    Bu kategoride kuşanılı eşyan yok
                  </Txt>
                </View>
              </>
            )}
          </View>

          <View style={styles.bolumBasi}>
            <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8 }}>TÜM EŞYALARIM</Txt>
            <Txt weight="bold" size={10} color={C.dim2}>{liste.length} adet</Txt>
          </View>

          {esyalar === null ? (
            <View style={{ paddingVertical: 54 }}><ActivityIndicator color={C.dim} /></View>
          ) : liste.length === 0 ? (
            <BosDurum anim={BOS_KUTU} dolgu={30} animBoyut={130} alt={BOS_METIN[tip]}>
              {/* Uygulamadaki tek "boş durumdan aksiyona" yolu — korunuyor. */}
              <Pressable onPress={() => { haptic.light(); router.navigate("/store"); }} style={styles.bosBtnSarma}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.bosBtn}>
                  <Txt weight="extrabold" size={12.5} color="#241A05">Mağazaya git</Txt>
                </Gradient>
              </Pressable>
            </BosDurum>
          ) : (
            <View style={styles.grid}>
              {liste.map((e) => {
                const sure = kalanSure(e.bitis);
                const nad = NADIRLIK[e.nadirlik] ?? NADIRLIK.standart;
                const aktif = e.kusanildi;
                return (
                  <View
                    key={e.id}
                    style={[
                      styles.card,
                      aktif
                        ? { borderColor: C.gold + "66", backgroundColor: C.gold + "0F" }
                        : { borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" },
                      sure.bitti && { opacity: 0.55 },
                    ]}
                  >
                    {aktif && (
                      <View style={styles.kusanildiRozet}>
                        <Icon name="check" size={9} sw={3} color="#241A05" />
                      </View>
                    )}
                    <View style={[styles.nadirlikRozet, { borderColor: nad.renk + "55", backgroundColor: nad.renk + "18" }]}>
                      <Txt weight="extrabold" size={8.5} color={nad.renk} style={{ letterSpacing: 0.5 }}>{nad.ad.toUpperCase()}</Txt>
                    </View>

                    <View style={styles.onizleme}>
                      <EsyaOnizleme tip={e.tip} tema={e.tema} size={56} />
                    </View>

                    <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{e.ad}</Txt>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Icon
                        name={sure.suresiz ? "check" : sure.bitti ? "warn" : "cal"}
                        size={10}
                        sw={2.2}
                        color={sure.suresiz ? C.green : sure.bitti ? C.red : C.dim2}
                      />
                      <Txt weight="semibold" size={9.5} color={sure.suresiz ? C.green : sure.bitti ? C.red : C.dim}>
                        {sure.metin}
                      </Txt>
                    </View>

                    {sure.bitti ? (
                      <Pressable
                        onPress={() => { haptic.light(); router.navigate("/store"); }}
                        style={{ width: "100%", marginTop: 12, borderRadius: 12, overflow: "hidden" }}
                      >
                        <View style={[styles.actBtn, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line }]}>
                          <Txt weight="extrabold" size={11.5} color={C.dim}>Uzat</Txt>
                        </View>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => degistir(e)}
                        disabled={!!islemde}
                        style={{ width: "100%", marginTop: 12, borderRadius: 12, overflow: "hidden", opacity: islemde && islemde !== e.id ? 0.5 : 1 }}
                      >
                        {islemde === e.id ? (
                          <View style={[styles.actBtn, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                            <ActivityIndicator size="small" color={C.gold} />
                          </View>
                        ) : aktif ? (
                          <View style={[styles.actBtn, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: C.line }]}>
                            <Txt weight="extrabold" size={11.5} color={C.dim}>Çıkar</Txt>
                          </View>
                        ) : (
                          <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.actBtn}>
                            <Txt weight="extrabold" size={11.5} color="#241A05">Kuşan</Txt>
                          </Gradient>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  magazaBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.gold + "38", backgroundColor: C.gold + "12" },
  kusaniliSerit: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" },
  cikarBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)" },
  bosMadalyon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", backgroundColor: "rgba(255,255,255,.04)" },
  bolumBasi: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, borderRadius: 18, paddingTop: 30, paddingHorizontal: 12, paddingBottom: 12, alignItems: "center", borderWidth: 1 },
  nadirlikRozet: { position: "absolute", top: 9, left: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  kusanildiRozet: { position: "absolute", top: 9, right: 9, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: C.gold2, zIndex: 2 },
  onizleme: { height: 66, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  actBtn: { paddingVertical: 9, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  bosBtnSarma: { borderRadius: 13, overflow: "hidden", marginTop: 2 },
  bosBtn: { paddingVertical: 11, paddingHorizontal: 22, alignItems: "center" },
});
