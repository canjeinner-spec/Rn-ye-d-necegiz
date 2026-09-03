import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BOS_KUTU from "@/anim/bos-kutu.json";
import { BosDurum } from "@/components/BosDurum";
import { DiamondBadge } from "@/components/Coins";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import { Yukleniyor } from "@/components/Yukleniyor";
import {
  aldiklarim,
  gonderdiklerim,
  hediyeOzetim,
  type AlinanHediye,
  type GidenHediye,
} from "@/data/remote/hediyeRepo";
import { giftPng } from "@/gifts/giftPng";
import { Icon } from "@/icons/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Zemin } from "@/theme/Zemin";

/**
 * Hediye Geçmişi.
 *
 * ÖNCEDEN TAMAMEN UYDURMAYDI. `src/data/giftHistory.ts` içindeki sabit dizi
 * gösteriliyordu — "Mervee'den taht", "Zeno Sv.'den 99 gül", "Dün 22:05".
 * Her kullanıcı aynı sahte geçmişi görüyordu ve kendi gönderdiği hediye hiç
 * görünmüyordu.
 *
 * Önce ALINAN tarafı temel şemanın `son_hediyelerim_v2`sine bağlanmıştı ama
 * oradaki `kazanc` alanı SIFIR dönüyordu: listede bütün satırlarda "+0"
 * yazıyordu. Özet kartı ise `toplam_deger` topluyordu, yani satırlar ile
 * toplam FARKLI SÜTUNDAN besleniyordu — toplam doğru, satırlar sıfır.
 *
 * Artık iki sekme de kendi fonksiyonlarımızdan geliyor (088 + 089) ve ikisi
 * de `hediye_gecmisi.toplam_deger` kullanıyor; satırlarla özet aynı şeyi
 * söylüyor. Özet LİSTEDEN toplanmıyor — listede yalnız son 30 satır var.
 */

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : String(n));

/** Bugün "14:32", dün "Dün 22:05", öncesi "3 gün önce". */
function zamanYaz(epoch: number): string {
  if (!epoch) return "";
  const d = new Date(epoch);
  const bugun = new Date();
  const gun = (a: Date) => new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const fark = Math.round((gun(bugun) - gun(d)) / 86400000);
  const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (fark <= 0) return saat;
  if (fark === 1) return `Dün ${saat}`;
  return `${fark} gün önce`;
}

/** İki sekmenin ortak satır biçimi. */
type Satir = {
  key: string;
  ad: string;
  emoji: string;
  kod: string | null;
  adet: number;
  kisi: string;
  tutar: number;
  tarih: number;
};

export default function GiftHistoryScreen() {
  const router = useRouter();
  const dbId = useApp((s) => s.dbId);
  const [tab, setTab] = useState(0);

  const [alinan, setAlinan] = useState<AlinanHediye[] | null>(null);
  const [giden, setGiden] = useState<GidenHediye[] | null>(null);
  const [ozet, setOzet] = useState<{ alinan: number; gonderilen: number } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || dbId == null) { setAlinan([]); setGiden([]); setOzet({ alinan: 0, gonderilen: 0 }); return; }
    let acik = true;
    aldiklarim(dbId, 30).then((r) => { if (acik) setAlinan(r); }).catch(() => { if (acik) setAlinan([]); });
    gonderdiklerim(dbId, 30).then((r) => { if (acik) setGiden(r); }).catch(() => { if (acik) setGiden([]); });
    hediyeOzetim(dbId).then((r) => { if (acik) setOzet(r); }).catch(() => { if (acik) setOzet({ alinan: 0, gonderilen: 0 }); });
    return () => { acik = false; };
  }, [dbId]);

  const yukleniyor = tab === 0 ? alinan === null : giden === null;
  const satirlar: Satir[] =
    tab === 0
      ? (alinan ?? []).map((r) => ({
          key: "a" + r.id, ad: r.ad, emoji: r.emoji, kod: r.kod,
          adet: r.adet, kisi: r.gonderen, tutar: r.tutar, tarih: r.tarih,
        }))
      : (giden ?? []).map((r) => ({
          key: "g" + r.id, ad: r.ad, emoji: r.emoji, kod: r.kod,
          adet: r.adet, kisi: r.alici, tutar: r.tutar, tarih: r.tarih,
        }));

  return (
    <View style={styles.root}>
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt weight="displayBold" size={16} color="#fff">Hediye Geçmişi</Txt>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.summary}>
          <View style={[styles.sumCard, { borderColor: C.green + "3D" }]}>
            <Txt weight="bold" size={10.5} color="#6EE7B7">Toplam Alınan</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <DiamondBadge size={16} />
              <Txt weight="displayBold" size={21} color="#fff">{ozet ? fmt(ozet.alinan) : "—"}</Txt>
            </View>
          </View>
          <View style={[styles.sumCard, { borderColor: C.gold + "3D" }]}>
            <Txt weight="bold" size={10.5} color={C.gold2}>Toplam Gönderilen</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <DiamondBadge size={16} />
              <Txt weight="displayBold" size={21} color="#fff">{ozet ? fmt(ozet.gonderilen) : "—"}</Txt>
            </View>
          </View>
        </View>

        <Tabs items={["Alınan", "Gönderilen"]} active={tab} set={setTab} fill pad={16} />

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {yukleniyor ? (
            <Yukleniyor yazi="Geçmiş yükleniyor" boyut={110} />
          ) : satirlar.length === 0 ? (
            <BosDurum
              anim={BOS_KUTU}
              animBoyut={140}
              baslik={tab === 0 ? "Henüz hediye almadın" : "Henüz hediye göndermedin"}
              alt={tab === 0 ? "Odalarda vakit geçirdikçe burası dolmaya başlar." : "Bir odada ya da profilden hediye gönderdiğinde burada görünür."}
            />
          ) : (
            satirlar.map((r) => {
              const png = giftPng(r.kod);
              return (
                <View key={r.key} style={styles.row}>
                  <View style={styles.giftIcon}>
                    {png ? (
                      <Image source={png} style={{ width: 38, height: 38 }} contentFit="contain" transition={0} />
                    ) : (
                      <Txt size={24}>{r.emoji}</Txt>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Txt weight="extrabold" size={13.5} color={C.text} numberOfLines={1} style={{ flexShrink: 1 }}>{r.ad}</Txt>
                      <Txt weight="bold" size={11.5} color={C.gold2}>×{r.adet}</Txt>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <Txt weight="bold" size={11} color={tab === 0 ? "#6EE7B7" : C.gold2}>{tab === 0 ? "Gönderen:" : "Alıcı:"}</Txt>
                      <Txt size={11} color={C.dim} numberOfLines={1} style={{ flexShrink: 1 }}>{r.kisi}</Txt>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Txt weight="extrabold" size={13} color={tab === 0 ? "#34D399" : C.gold2}>{tab === 0 ? "+" : "−"}</Txt>
                      <DiamondBadge size={13} />
                      <Txt weight="extrabold" size={13} color={tab === 0 ? "#34D399" : C.gold2}>{fmt(r.tutar)}</Txt>
                    </View>
                    <Txt weight="semibold" size={10} color={C.dim2} style={{ marginTop: 3 }}>{zamanYaz(r.tarih)}</Txt>
                  </View>
                </View>
              );
            })
          )}
          {!yukleniyor && satirlar.length > 0 && (
            <Txt size={10.5} color={C.dim2} align="center" style={{ marginTop: 16 }}>Son 30 kayıt gösteriliyor</Txt>
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
  summary: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 8 },
  sumCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, backgroundColor: C.kart },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  giftIcon: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.10)", backgroundColor: C.kart, overflow: "hidden" },
});
