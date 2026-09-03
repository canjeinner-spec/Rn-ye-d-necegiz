import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge } from "@/components/Coins";
import { EsyaOnizleme } from "@/components/EsyaOnizleme";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { Yukleniyor } from "@/components/Yukleniyor";
import { NADIRLIK } from "@/data/esyaTemalari";
import { katalog, satinAl, type Esya, type EsyaTip } from "@/data/remote/esyaRepo";
import { esyalarim } from "@/data/remote/esyaRepo";
import { getMyBalance } from "@/data/remote/walletRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const SEKMELER: [EsyaTip, string][] = [
  ["cerceve", "Çerçeveler"],
  ["giris", "Giriş Efekti"],
  ["balon", "Sohbet Balonu"],
];

/**
 * Mağaza — 056 kataloğundan okur, altınla gerçekten satın alır.
 *
 * Eskiden: katalog data/store.ts sabitiydi (9 çerçeve), bakiye ekranda yazan
 * `const COINS = 12400` sabitiydi, "Satın Al" yalnızca yerel bir Set'e
 * ekliyordu. Hiçbiri kaydedilmiyordu.
 */
export default function StoreScreen() {
  const router = useRouter();
  const [tabIx, setTabIx] = useState(0);
  const [urunler, setUrunler] = useState<Esya[] | null>(null);
  const [sahip, setSahip] = useState<Set<string>>(new Set());
  const [altin, setAltin] = useState<number | null>(null);
  const [alinan, setAlinan] = useState<string | null>(null); // işlemdeki eşya
  const [mesaj, setMesaj] = useState<{ metin: string; hata: boolean } | null>(null);

  const tip = SEKMELER[tabIx][0];

  const yukle = useCallback(async () => {
    if (!isSupabaseConfigured) { setUrunler([]); return; }
    try {
      const [k, ben, bakiye] = await Promise.all([
        katalog(),
        esyalarim().catch(() => []),
        getMyBalance().catch(() => null),
      ]);
      setUrunler(k);
      setSahip(new Set(ben.filter((e) => e.bitis == null || e.bitis > Date.now()).map((e) => e.id)));
      if (bakiye) setAltin(bakiye.altin);
    } catch (e) {
      console.warn("[magaza]", (e as Error)?.message || e);
      setUrunler([]);
      setMesaj({ metin: "Mağaza yüklenemedi.", hata: true });
    }
  }, []);

  useFocusEffect(useCallback(() => { yukle(); }, [yukle]));

  const satinAlBas = async (e: Esya) => {
    if (alinan) return;
    haptic.light();
    setAlinan(e.id);
    setMesaj(null);
    try {
      const yeni = await satinAl(e.id);
      setAltin(yeni.altin);
      setSahip((s) => new Set(s).add(e.id));
      haptic.success();
      setMesaj({ metin: `${e.ad} alındı — Eşyalarım'dan kuşanabilirsin.`, hata: false });
    } catch (err) {
      haptic.warning();
      const m = (err as Error)?.message || "Satın alınamadı.";
      setMesaj({ metin: m.replace(/^.*Yetersiz altın.*$/i, "Yetersiz altın."), hata: true });
    } finally {
      setAlinan(null);
    }
  };

  const liste = (urunler ?? []).filter((u) => u.tip === tip);

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Gradient colors={[C.gold + "1A", "transparent"]} deg={180} style={styles.aura} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1 }}>Mağaza</Txt>
          <View style={styles.bakiye}>
            <CoinBadge size={15} />
            <Txt weight="extrabold" size={12.5} color={C.gold2}>
              {altin == null ? "—" : altin.toLocaleString("tr-TR")}
            </Txt>
          </View>
          <Pressable onPress={() => { haptic.light(); router.navigate("/inventory"); }} style={styles.iconBtn}>
            <Icon name="ticket" size={15} color={C.gold2} />
          </Pressable>
        </View>

        <Tabs items={SEKMELER.map(([, ad]) => ad)} active={tabIx} set={setTabIx} pad={16} />

        {mesaj && (
          <View style={[styles.mesaj, mesaj.hata ? styles.mesajHata : styles.mesajOk]}>
            <Icon name={mesaj.hata ? "warn" : "check"} size={14} sw={2.2} color={mesaj.hata ? C.red : C.green} />
            <Txt weight="semibold" size={11.5} color={mesaj.hata ? C.red : C.green} lh={1.4} style={{ flex: 1 }}>
              {mesaj.metin}
            </Txt>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {urunler === null ? (
            <Yukleniyor dolgu={30} boyut={110} yazi="Mağaza yükleniyor" />
          ) : liste.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 50, gap: 10 }}>
              <View style={styles.bosIkon}><Icon name="bank" size={20} color={C.dim2} /></View>
              <Txt size={12.5} color={C.dim} align="center" lh={1.55} style={{ maxWidth: 250 }}>
                Katalog boş görünüyor. 056 migration'ı çalıştırıldı mı?
              </Txt>
            </View>
          ) : (
            <View style={styles.grid}>
              {liste.map((u) => {
                const bende = sahip.has(u.id);
                const nad = NADIRLIK[u.nadirlik] ?? NADIRLIK.standart;
                const yetersiz = altin != null && altin < u.fiyatAltin;
                return (
                  <View key={u.id} style={[styles.card, { borderColor: bende ? C.green + "44" : "rgba(255,255,255,.08)" }]}>
                    <View style={[styles.nadirlikRozet, { borderColor: nad.renk + "55", backgroundColor: nad.renk + "18" }]}>
                      <Txt weight="extrabold" size={8.5} color={nad.renk} style={{ letterSpacing: 0.5 }}>{nad.ad.toUpperCase()}</Txt>
                    </View>

                    <View style={styles.onizleme}>
                      <EsyaOnizleme tip={u.tip} tema={u.tema} size={58} />
                    </View>

                    <Txt weight="extrabold" size={12.5} color={C.text} numberOfLines={1}>{u.ad}</Txt>
                    <Txt size={9.5} color={C.dim2} numberOfLines={2} lh={1.45} align="center" style={{ marginTop: 3, minHeight: 26 }}>
                      {u.aciklama}
                    </Txt>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                      <CoinBadge size={13} />
                      <Txt weight="extrabold" size={12.5} color={C.gold2}>{u.fiyatAltin.toLocaleString("tr-TR")}</Txt>
                      <Txt weight="semibold" size={9.5} color={C.dim2}>· {u.sureGun ? `${u.sureGun} gün` : "süresiz"}</Txt>
                    </View>

                    <Pressable
                      onPress={() => satinAlBas(u)}
                      disabled={!!alinan}
                      style={{ width: "100%", marginTop: 11, borderRadius: 12, overflow: "hidden", opacity: alinan && alinan !== u.id ? 0.5 : 1 }}
                    >
                      {bende ? (
                        <View style={[styles.btn, { backgroundColor: C.green + "14", borderWidth: 1, borderColor: C.green + "40" }]}>
                          <Icon name="check" size={13} sw={2.5} color="#6EE7B7" />
                          <Txt weight="extrabold" size={11.5} color="#6EE7B7">{u.sureGun ? "Uzat" : "Sende var"}</Txt>
                        </View>
                      ) : alinan === u.id ? (
                        <View style={[styles.btn, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                          <ActivityIndicator size="small" color={C.gold} />
                        </View>
                      ) : (
                        <Gradient colors={yetersiz ? ["#3A3A44", "#26262E"] : [C.gold2, "#C8922B"]} deg={135} style={styles.btn}>
                          <Txt weight="extrabold" size={11.5} color={yetersiz ? C.dim : "#241A05"}>
                            {yetersiz ? "Altın yetmiyor" : "Satın Al"}
                          </Txt>
                        </Gradient>
                      )}
                    </Pressable>
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
  header: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  bakiye: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.gold + "38", backgroundColor: C.gold + "12" },
  mesaj: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, padding: 11, borderRadius: 13, borderWidth: 1 },
  mesajOk: { backgroundColor: C.green + "12", borderColor: C.green + "33" },
  mesajHata: { backgroundColor: C.red + "12", borderColor: C.red + "33" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, borderRadius: 18, paddingTop: 30, paddingHorizontal: 12, paddingBottom: 12, alignItems: "center", borderWidth: 1, backgroundColor: "rgba(255,255,255,.04)" },
  nadirlikRozet: { position: "absolute", top: 9, left: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  onizleme: { height: 66, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12 },
  bosIkon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
});
