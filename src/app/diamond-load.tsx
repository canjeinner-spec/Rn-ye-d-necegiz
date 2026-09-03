import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Txt } from "@/components/Txt";
import { YakindaNotu } from "@/components/YakindaNotu";
import { ELMAS_PAKETLERI } from "@/data/wallet";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

const DIA = "#22D3EE";

export default function DiamondLoad() {
  const router = useRouter();
  const [sel, setSel] = useState(2);
  const [done, setDone] = useState(false);
  const p = ELMAS_PAKETLERI[sel];

  /**
   * SAHTE BAŞARI KALDIRILDI. Burası `haptic.success()` çalıp "Satın alma
   * başarılı! N elmas hesabına eklendi" diyordu — ne ödeme alınıyordu ne de
   * bakiye değişiyordu. Gerçek satın alma `expo-iap` + dev build + makbuz
   * doğrulama istiyor (Faz 4.11). O gelene kadar dürüst durum gösteriliyor.
   */
  const buy = () => { haptic.warning(); setDone(true); };

  return (
    <View style={styles.root}>
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <DiamondBadge size={22} />
          <Txt weight="displayBold" size={16} color="#fff">Elmas Yükle</Txt>
        </View>

        {done ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}>
            <View style={styles.uyariIkon}>
              <Icon name="warn" size={30} color={C.gold2} />
            </View>
            <Txt weight="displayBold" size={17} color="#fff" align="center" style={{ marginTop: 16 }}>
              Satın alma henüz açık değil
            </Txt>
            <Txt size={12.5} color={C.dim} align="center" lh={1.55} style={{ marginTop: 10, maxWidth: 290 }}>
              Elmas yükleme, uygulama mağazaya çıktığında App Store ve Play Store
              üzerinden açılacak. Şu an ödeme alınmıyor ve hesabına elmas
              eklenmedi.
            </Txt>
            <Pressable onPress={() => setDone(false)} style={{ alignSelf: "stretch", marginTop: 24, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 14, alignItems: "center" }}>
                <Txt weight="extrabold" size={13.5} color="#241A05">Anladım</Txt>
              </Gradient>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <YakindaNotu metin="Ödeme sistemi henüz açık değil. Paketler ve fiyatlar önizleme amaçlı; satın alma mağaza sürümüyle açılacak." />
              <Txt size={11.5} color={C.dim} lh={1.5} style={{ marginTop: 14, marginBottom: 14 }}>
                Elmas; hediye göndermek ve mağazadan eşya almak için kullanılır.
              </Txt>
              <View style={styles.grid}>
                {ELMAS_PAKETLERI.map((pk, i) => {
                  const on = i === sel;
                  return (
                    <Pressable key={pk.id} onPress={() => setSel(i)} style={[styles.pack, { borderColor: on ? DIA : C.line, backgroundColor: on ? DIA + "12" : C.card }]}>
                      {pk.populer && (
                        <Gradient colors={["#22D3EE", "#0891B2"]} deg={90} style={styles.popular}>
                          <Txt weight="extrabold" size={8.5} color="#04252B" style={{ letterSpacing: 0.5 }}>EN POPÜLER</Txt>
                        </Gradient>
                      )}
                      {!!pk.bonus && (
                        <View style={[styles.bonus, { top: pk.populer ? 18 : 7 }]}>
                          <Txt weight="extrabold" size={8.5} color={C.green}>+%{Math.round((pk.bonus / pk.elmas) * 100)}</Txt>
                        </View>
                      )}
                      <View style={{ marginTop: pk.populer ? 14 : 4, marginBottom: 6 }}>
                        <DiamondBadge size={34} />
                      </View>
                      <Txt weight="displayBold" size={15} color={on ? "#5EEAD4" : C.text}>{pk.elmas.toLocaleString("tr-TR")}</Txt>
                      <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>elmas</Txt>
                      <View style={[styles.price, { backgroundColor: on ? DIA + "1A" : "rgba(255,255,255,.05)" }]}>
                        <Txt weight="extrabold" size={12} color={on ? "#5EEAD4" : C.text}>${pk.fiyat}</Txt>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Pressable onPress={buy} style={{ borderRadius: 15, overflow: "hidden" }}>
                <Gradient colors={["#22D3EE", "#0891B2"]} deg={135} style={{ paddingVertical: 15, alignItems: "center" }}>
                  <Txt weight="extrabold" size={13.5} color="#04252B">{p.elmas.toLocaleString("tr-TR")} Elmas · ${p.fiyat} — Satın Al</Txt>
                </Gradient>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  uyariIkon: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.gold + "45", backgroundColor: C.gold + "14",
  },
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pack: { width: "47.5%", flexGrow: 1, alignItems: "center", borderRadius: 18, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 10, borderWidth: 1.5, overflow: "hidden" },
  popular: { position: "absolute", top: 0, left: 0, right: 0, paddingVertical: 2, alignItems: "center" },
  bonus: { position: "absolute", right: 7, backgroundColor: C.green + "22", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  price: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 18, borderRadius: 10 },
});
