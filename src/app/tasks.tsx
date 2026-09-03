import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge } from "@/components/Coins";
import { Tabs } from "@/components/Tabs";
import { BosDurum } from "@/components/BosDurum";
import { Txt } from "@/components/Txt";
import BOS_KUTU from "@/anim/bos-kutu.json";
import {
  girisDurumu, girisOdulAl, gorevOdulAl, gorevlerim,
  type GirisDurumu, type Gorev,
} from "@/data/remote/gorevRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { useCachedResource } from "@/lib/cache";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

/** Görev koduna göre ikon — katalogdaki `ikon_url` yerine yerel çizim. */
const IKON: Record<string, IconName> = {
  oda_katil: "door",
  mesaj_yaz: "chat",
  hediye_gonder: "gift",
  hediye_al: "heart",
  takip_et: "userAdd",
};

/** Görev ilerleme çubuğu — "4/10" tek başına ne kadar kaldığını göstermiyordu. */
function Cubuk({ oran }: { oran: number }) {
  return (
    <View style={styles.cubuk}>
      <View style={[styles.cubukDolu, { width: `${Math.round(Math.min(1, oran) * 100)}%` }]} />
    </View>
  );
}

export default function TasksScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [mesaj, setMesaj] = useState<{ metin: string; hata: boolean } | null>(null);
  const [islem, setIslem] = useState<string | null>(null);

  const acik = isSupabaseConfigured;
  const { data: gorevler = [], refresh: gorevleriYenile } = useCachedResource<Gorev[]>(
    "gorev:liste", () => gorevlerim(), { persist: true, enabled: acik },
  );
  const { data: giris, refresh: girisiYenile } = useCachedResource<GirisDurumu>(
    "gorev:giris", () => girisDurumu(), { persist: true, enabled: acik },
  );

  const gunler = giris?.gunler ?? [];
  const bugun = gunler.find((g) => g.bugun);
  const bugunAlindi = !!bugun?.alindi;

  const girisAl = async () => {
    if (islem || !bugun || bugunAlindi) return;
    haptic.light();
    setIslem("giris");
    setMesaj(null);
    try {
      const s = await girisOdulAl();
      haptic.success();
      setMesaj({ metin: `${s.gun}. gün ödülü alındı — +${s.odul.toLocaleString("tr-TR")} altın`, hata: false });
      girisiYenile();
    } catch (e) {
      haptic.warning();
      setMesaj({ metin: (e as Error)?.message || "Ödül alınamadı.", hata: true });
    } finally {
      setIslem(null);
    }
  };

  const gorevAl = async (g: Gorev) => {
    if (islem) return;
    haptic.light();
    setIslem(g.kod);
    setMesaj(null);
    try {
      const s = await gorevOdulAl(g.kod);
      haptic.success();
      setMesaj({ metin: `${g.ad} tamam — +${s.odul.toLocaleString("tr-TR")} altın`, hata: false });
      gorevleriYenile();
    } catch (e) {
      haptic.warning();
      setMesaj({ metin: (e as Error)?.message || "Ödül alınamadı.", hata: true });
    } finally {
      setIslem(null);
    }
  };

  return (
    <View style={styles.root}>
      {/* Cüzdan ve profille aynı siyah-altın zemin; ekran mor (#1E1330) idi. */}
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Görevler</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <Tabs items={["Günlük Giriş", "Görevler"]} active={tab} set={setTab} fill pad={16} />

        {mesaj && (
          <View style={[styles.mesaj, mesaj.hata ? styles.mesajHata : styles.mesajOk]}>
            <Icon name={mesaj.hata ? "warn" : "check"} size={14} sw={2.2} color={mesaj.hata ? C.red : C.green} />
            <Txt weight="semibold" size={11.5} color={mesaj.hata ? C.red : C.green} lh={1.4} style={{ flex: 1 }}>
              {mesaj.metin}
            </Txt>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {tab === 0 ? (
            gunler.length === 0 ? (
              <BosDurum anim={BOS_KUTU} dolgu={30} animBoyut={130} alt="Günlük giriş ödülleri henüz açılmadı." />
            ) : (
              <>
                {/* Kart cüzdandaki bakiye kartıyla aynı dil: siyah cam, altın
                    kenar, üstte ince parıltı ve köşede altın ışık. */}
                <View style={styles.dailyCard}>
                  <Gradient colors={["rgba(232,179,65,.14)", "transparent"]} deg={155} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <View style={styles.cardSheen} pointerEvents="none" />
                  <View style={styles.cardGlow} pointerEvents="none" />
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="displayBold" size={15} color="#fff">Günlük Giriş Ödülü</Txt>
                      <Txt size={11} color={C.dim} style={{ marginTop: 4 }}>Her gün giriş yap, 7. günde büyük ödülü kap.</Txt>
                    </View>
                    {/* Seri gerçek: bir gün atlanırsa sunucuda sıfırlanıyor. */}
                    {(giris?.seri ?? 0) > 0 && (
                      <View style={styles.seriHap}>
                        <Icon name="flame" size={12} color={C.gold2} />
                        <Txt weight="extrabold" size={11} color={C.gold2}>{giris?.seri} gün</Txt>
                      </View>
                    )}
                  </View>

                  <View style={styles.dailyGrid}>
                    {gunler.map((d) => {
                      const buyuk = d.gun === 7;
                      return (
                        <View
                          key={d.gun}
                          style={[
                            styles.dayCell,
                            { width: buyuk ? "100%" : "22%" },
                            {
                              backgroundColor: d.alindi ? `${C.green}1A` : d.bugun ? `${C.gold}1A` : "rgba(255,255,255,.04)",
                              borderColor: d.alindi ? `${C.green}44` : d.bugun ? C.gold : "rgba(255,255,255,.08)",
                            },
                          ]}
                        >
                          <Txt weight="bold" size={9} color={C.dim}>{d.gun}. Gün</Txt>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginVertical: 5 }}>
                            <CoinBadge size={buyuk ? 18 : 14} />
                            <Txt weight="displayBold" size={buyuk ? 15 : 12.5} color={buyuk ? C.gold2 : C.text}>
                              {d.miktar.toLocaleString("tr-TR")}
                            </Txt>
                          </View>
                          {d.alindi ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              <Icon name="check" size={9} sw={3.5} color={C.green} />
                              <Txt weight="extrabold" size={8.5} color={C.green}>Alındı</Txt>
                            </View>
                          ) : d.bugun ? (
                            <Txt weight="extrabold" size={8.5} color={C.gold2}>Bugün</Txt>
                          ) : (
                            <Txt weight="bold" size={8.5} color={C.dim2}>—</Txt>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>

                <Pressable
                  onPress={girisAl}
                  disabled={bugunAlindi || islem === "giris"}
                  style={{ marginTop: 16, borderRadius: 15, overflow: "hidden", opacity: bugunAlindi ? 0.55 : 1 }}
                >
                  {bugunAlindi ? (
                    <View style={[styles.claimBtn, { backgroundColor: C.kontrol, borderWidth: 1, borderColor: "rgba(255,255,255,.12)" }]}>
                      <Icon name="check" size={15} sw={3} color={C.dim} />
                      <Txt weight="extrabold" size={13.5} color={C.dim}>Bugünün ödülü alındı</Txt>
                    </View>
                  ) : (
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.claimBtn}>
                      <Txt weight="extrabold" size={13.5} color="#241A05">{bugun?.gun}. Gün ödülünü al</Txt>
                      <CoinBadge size={15} />
                      <Txt weight="extrabold" size={13.5} color="#241A05">{(bugun?.miktar ?? 0).toLocaleString("tr-TR")}</Txt>
                    </Gradient>
                  )}
                </Pressable>
              </>
            )
          ) : gorevler.length === 0 ? (
            <BosDurum anim={BOS_KUTU} dolgu={30} animBoyut={130} alt="Görevler henüz açılmadı." />
          ) : (
            gorevler.map((t) => {
              const tamam = t.ilerleme >= t.hedef;
              const alinabilir = tamam && !t.alindi;
              return (
                <View key={t.kod} style={styles.taskRow}>
                  <View style={styles.taskIcon}>
                    <Icon name={IKON[t.kod] ?? "trophy"} size={17} color={C.gold2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={12.5} color={C.text}>{t.ad}</Txt>
                    <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>{t.aciklama}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                      <CoinBadge size={12} />
                      <Txt weight="extrabold" size={10.5} color={C.gold2}>+{t.odul.toLocaleString("tr-TR")}</Txt>
                      <Txt weight="semibold" size={9.5} color={C.dim2} style={{ marginLeft: 4 }}>
                        {Math.min(t.ilerleme, t.hedef)}/{t.hedef}
                      </Txt>
                    </View>
                    {t.hedef > 1 && !t.alindi && <Cubuk oran={t.ilerleme / t.hedef} />}
                  </View>
                  <Pressable
                    onPress={() => gorevAl(t)}
                    disabled={!alinabilir || islem === t.kod}
                    style={{ borderRadius: 11, overflow: "hidden" }}
                  >
                    {t.alindi ? (
                      <View style={[styles.taskBtn, { backgroundColor: C.green + "1A", borderWidth: 1, borderColor: C.green + "3D" }]}>
                        <Icon name="check" size={12} sw={3} color={C.green} />
                      </View>
                    ) : alinabilir ? (
                      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={styles.taskBtn}>
                        <Txt weight="extrabold" size={11} color="#241A05">Al</Txt>
                      </Gradient>
                    ) : (
                      <View style={[styles.taskBtn, { backgroundColor: C.kontrol }]}>
                        <Txt weight="extrabold" size={11} color={C.dim2}>Devam</Txt>
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  aura: { position: "absolute", top: 0, left: 0, right: 0, height: 230 },

  mesaj: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, padding: 11, borderRadius: 13, borderWidth: 1 },
  mesajOk: { backgroundColor: C.green + "12", borderColor: C.green + "33" },
  mesajHata: { backgroundColor: C.red + "12", borderColor: C.red + "33" },

  dailyCard: { borderRadius: 20, padding: 16, paddingTop: 18, borderWidth: 1, borderColor: C.gold + "3D", backgroundColor: "rgba(18,15,24,.72)", overflow: "hidden" },
  cardSheen: { position: "absolute", top: 0, left: 26, right: 26, height: 1, backgroundColor: "rgba(255,255,255,.28)" },
  cardGlow: { position: "absolute", right: -46, top: -56, width: 170, height: 170, borderRadius: 85, backgroundColor: C.gold + "1A" },
  seriHap: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "3D" },
  dailyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  dayCell: { borderRadius: 13, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", borderWidth: 1 },
  claimBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: 15 },

  taskRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 15, backgroundColor: C.kart, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", marginBottom: 9 },
  taskIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: C.gold + "1A", borderWidth: 1, borderColor: C.gold + "3D" },
  taskBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 11, alignItems: "center", justifyContent: "center", minWidth: 52 },
  cubuk: { height: 4, borderRadius: 2, backgroundColor: C.kartUst, overflow: "hidden", marginTop: 7 },
  cubukDolu: { height: 4, borderRadius: 2, backgroundColor: C.gold },
});
