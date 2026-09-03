import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { YakindaNotu } from "@/components/YakindaNotu";
import { ID_DIRECTORY, SELF_FEE, USD_TO_DIAMOND } from "@/data/withdraw";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

const MY_ID = "4407";
const EARNINGS = 142.5;

const ADIMLAR = ["Tutar", "Alıcı", "Onay"];

/**
 * Para çekme.
 *
 * Eski hâli tek uzun formdu: tutarı yaz, alıcı ID'sini yaz, buton, iki modal.
 * Kesinti kutusu ancak kendi ID'ni yazınca beliriyordu — yani %16'lık kesintiyi
 * ancak deneme yanılmayla keşfediyordun. Ekran da baştan sona yeşildi
 * (#0C2A1E zemin, yeşil buton, yeşil onay), uygulamanın teması siyah-altın.
 *
 * Yeni akış üç adım: TUTAR → ALICI → ONAY. Her adımda tek karar var, kesinti
 * alıcı seçilirken açıkça yazıyor, son ekranda dökümün tamamı görünüyor.
 */
export default function WithdrawScreen() {
  const router = useRouter();
  const [adim, setAdim] = useState(0);
  const [amount, setAmount] = useState("");
  const [kendime, setKendime] = useState<boolean | null>(null);
  const [toId, setToId] = useState("");
  const [done, setDone] = useState(false);

  const usd = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const fazla = usd > EARNINGS;
  const tutarOk = usd > 0 && !fazla;

  const idTrim = kendime ? MY_ID : toId.trim();
  const found = idTrim.length >= 3 ? ID_DIRECTORY[idTrim] : undefined;
  const aliciOk = kendime === true || (kendime === false && !!found && idTrim !== MY_ID);

  const kesintiUSD = kendime ? usd * SELF_FEE : 0;
  const netUSD = usd - kesintiUSD;
  const netElmas = Math.floor(netUSD * USD_TO_DIAMOND);

  const yuzdeUygula = (o: number) => { haptic.select(); setAmount((EARNINGS * o).toFixed(2)); };

  const ileri = () => { haptic.light(); setAdim((a) => a + 1); };
  const geri = () => { haptic.light(); setAdim((a) => Math.max(0, a - 1)); };
  /**
   * SAHTE BAŞARI KALDIRILDI. Burası `haptic.success()` çalıp "Çekim
   * tamamlandı, $X karşılığı N elmas gönderildi" diyordu. Hiçbir şey
   * gönderilmiyordu: ne RPC vardı ne `withdrawal_requests` kaydı; ekrandaki
   * `EARNINGS`, `MY_ID` ve `ID_DIRECTORY` sabit örneklerdi.
   *
   * Para söz konusuyken sahte başarı en kötü hata türü — kullanıcı parasını
   * çektiğini sanır. Akış ve tasarım DURUYOR (Faz 4.10'da gerçeğe bağlanacak),
   * yalnız sonuç ekranı doğruyu söylüyor.
   */
  const gonder = () => { haptic.warning(); setDone(true); };

  // ---- Başarı ekranı (modal değil, tam ekran) ------------------------------
  if (done) {
    return (
      <View style={styles.root}>
        <Zemin />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <Animated.View entering={FadeIn.duration(260)} style={styles.basariSarma}>
            <View style={styles.uyariIkon}>
              <Icon name="warn" size={32} color={C.gold2} />
            </View>
            <Txt weight="displayBold" size={20} color="#fff" align="center" style={{ marginTop: 18 }}>Çekim henüz açık değil</Txt>
            <Txt size={12.5} color={C.dim} align="center" lh={1.55} style={{ marginTop: 8, maxWidth: 290 }}>
              Kazanç çekme sistemi devreye alınmadı. Talebin KAYDEDİLMEDİ ve
              hesabından hiçbir tutar düşülmedi. Aşağıdaki döküm, sistem
              açıldığında nasıl hesaplanacağını gösteriyor.
            </Txt>

            <View style={styles.basariKart}>
              <Satir etiket="Tutar" deger={`$${usd.toFixed(2)}`} />
              {kendime && <Satir etiket={`Kesinti (%${(SELF_FEE * 100).toFixed(0)})`} deger={`−$${kesintiUSD.toFixed(2)}`} renk={C.red} />}
              <View style={styles.ayirici} />
              <Satir etiket="Hesaba geçen" deger={`${netElmas.toLocaleString("tr-TR")} elmas`} renk="#67E8F9" kalin />
            </View>

            <Pressable onPress={() => setDone(false)} style={styles.anaBtnSarma}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.anaBtn}>
                <Txt weight="extrabold" size={13.5} color="#241A05">Anladım</Txt>
              </Gradient>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Zemin />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
          <View style={styles.header}>
            <Pressable onPress={() => (adim === 0 ? router.back() : geri())} style={styles.iconBtn}>
              <Icon name="back" size={16} color={C.text} />
            </Pressable>
            <Txt weight="displayBold" size={16} color="#fff" style={{ flex: 1 }}>Para Çek</Txt>
            <View style={styles.ornekCip}>
              <Txt weight="bold" size={8.5} color={C.dim2} style={{ letterSpacing: 0.6 }}>ÖRNEK VERİ</Txt>
            </View>
          </View>

          {/* Adım göstergesi — kaç adım kaldığı belli olsun */}
          <View style={styles.adimSerit}>
            {ADIMLAR.map((a, i) => (
              <View key={a} style={{ flex: 1, gap: 6 }}>
                <View style={[styles.adimCizgi, { backgroundColor: i <= adim ? C.gold : "rgba(255,255,255,.09)" }]} />
                <Txt weight={i === adim ? "extrabold" : "semibold"} size={9.5} color={i === adim ? C.gold2 : C.dim2} style={{ letterSpacing: 0.5 }}>
                  {i + 1}. {a}
                </Txt>
              </View>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ---------------------------------------------------- 1) TUTAR */}
            {adim === 0 && (
              <>
                {/* Uyarı EN BAŞTA: kullanıcı üç adımı doldurduktan SONRA
                    "aslında çalışmıyor" demek, sahte başarıdan biraz daha az
                    kötü olurdu — baştan söylemek doğrusu. */}
                <YakindaNotu metin="Çekim sistemi henüz açık değil. Buradaki kazanç ve bakiye rakamları örnektir; talep oluşturulmaz." />
                <View style={[styles.kazancKart, { marginTop: 14 }]}>
                  <Gradient colors={[C.gold + "1F", "rgba(255,255,255,.02)"]} deg={150} style={StyleSheet.absoluteFill} />
                  <Txt weight="bold" size={10} color={C.gold2} style={{ letterSpacing: 0.8 }}>ÇEKİLEBİLİR KAZANÇ</Txt>
                  <Txt weight="displayBold" size={30} color="#fff" style={{ marginTop: 6 }}>${EARNINGS.toFixed(2)}</Txt>
                </View>

                <Txt weight="bold" size={10} color={C.dim} style={styles.etiket}>ÇEKİLECEK TUTAR</Txt>
                <View style={[styles.tutarKutu, { borderColor: fazla ? C.red : amount ? C.gold : "rgba(255,255,255,.12)" }]}>
                  <Txt weight="displayBold" size={26} color={C.dim2}>$</Txt>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.dim2}
                    style={styles.tutarGiris}
                  />
                </View>
                {fazla && <Txt weight="semibold" size={10.5} color={C.red} style={{ marginTop: 7 }}>Kazancından fazla çekemezsin.</Txt>}

                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  {([["%25", 0.25], ["%50", 0.5], ["Tümü", 1]] as const).map(([lbl, o]) => (
                    <Pressable key={lbl} onPress={() => yuzdeUygula(o)} style={styles.oranCip}>
                      <Txt weight="extrabold" size={11.5} color={C.gold2}>{lbl}</Txt>
                    </Pressable>
                  ))}
                </View>

                {tutarOk && (
                  <View style={styles.cevrimSatiri}>
                    <Txt weight="semibold" size={11} color={C.dim}>Karşılığı</Txt>
                    <View style={{ flex: 1 }} />
                    <DiamondBadge size={13} />
                    <Txt weight="extrabold" size={12.5} color="#67E8F9">{Math.floor(usd * USD_TO_DIAMOND).toLocaleString("tr-TR")}</Txt>
                    <Txt weight="semibold" size={11} color={C.dim}>elmas</Txt>
                  </View>
                )}

                <Pressable onPress={ileri} disabled={!tutarOk} style={[styles.anaBtnSarma, { opacity: tutarOk ? 1 : 0.45 }]}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.anaBtn}>
                    <Txt weight="extrabold" size={13.5} color="#241A05">Devam</Txt>
                  </Gradient>
                </Pressable>
              </>
            )}

            {/* ---------------------------------------------------- 2) ALICI */}
            {adim === 1 && (
              <>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8, marginBottom: 10 }}>KİME GÖNDERİLECEK?</Txt>

                {/* Kesinti artık burada, seçmeden ÖNCE yazıyor. */}
                <Pressable onPress={() => { haptic.select(); setKendime(true); }} style={[styles.secenek, kendime === true && styles.secenekAcik]}>
                  <View style={[styles.secenekIkon, { borderColor: C.gold + "3D", backgroundColor: C.gold + "14" }]}>
                    <Icon name="user" size={17} color={C.gold2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={13} color={C.text}>Kendi hesabıma</Txt>
                    <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>
                      %{(SELF_FEE * 100).toFixed(0)} işlem kesintisi uygulanır
                    </Txt>
                  </View>
                  {kendime === true && <Icon name="check" size={17} sw={2.6} color={C.gold2} />}
                </Pressable>

                <Pressable onPress={() => { haptic.select(); setKendime(false); }} style={[styles.secenek, kendime === false && styles.secenekAcik, { marginTop: 10 }]}>
                  <View style={[styles.secenekIkon, { borderColor: "rgba(103,232,249,.30)", backgroundColor: "rgba(34,211,238,.12)" }]}>
                    <Icon name="send" size={17} color="#67E8F9" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="extrabold" size={13} color={C.text}>Başka bir hesaba</Txt>
                    <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>Kesinti yok — tamamı geçer</Txt>
                  </View>
                  {kendime === false && <Icon name="check" size={17} sw={2.6} color={C.gold2} />}
                </Pressable>

                {kendime === false && (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Txt weight="bold" size={10} color={C.dim} style={styles.etiket}>ALICI HESAP ID</Txt>
                    <View style={[styles.idKutu, { borderColor: found && idTrim !== MY_ID ? C.green : idTrim.length >= 3 ? C.red : "rgba(255,255,255,.12)" }]}>
                      <Icon name="search" size={16} color={C.dim} />
                      <TextInput
                        value={toId}
                        onChangeText={setToId}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="Örn: 8821"
                        placeholderTextColor={C.dim2}
                        style={styles.idGiris}
                      />
                    </View>

                    {found && idTrim !== MY_ID && (
                      <View style={styles.bulunanKart}>
                        <Portrait name={found.name} size={40} ring={C.green} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt weight="extrabold" size={13} color={C.text} numberOfLines={1}>{found.name}</Txt>
                          <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>ID {idTrim} · LV.{found.lv}</Txt>
                        </View>
                        <Icon name="check" size={18} sw={2.6} color={C.green} />
                      </View>
                    )}
                    {idTrim.length >= 3 && !found && (
                      <Txt weight="semibold" size={10.5} color={C.red} style={{ marginTop: 8 }}>Bu ID'ye sahip kullanıcı bulunamadı.</Txt>
                    )}
                    {idTrim === MY_ID && (
                      <Txt weight="semibold" size={10.5} color={C.gold2} style={{ marginTop: 8 }}>Bu senin ID'n — üstteki seçeneği kullan.</Txt>
                    )}
                  </Animated.View>
                )}

                <Pressable onPress={ileri} disabled={!aliciOk} style={[styles.anaBtnSarma, { opacity: aliciOk ? 1 : 0.45 }]}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.anaBtn}>
                    <Txt weight="extrabold" size={13.5} color="#241A05">Devam</Txt>
                  </Gradient>
                </Pressable>
              </>
            )}

            {/* ----------------------------------------------------- 3) ONAY */}
            {adim === 2 && (
              <>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.8, marginBottom: 10 }}>ÖZET</Txt>

                <View style={styles.ozetKart}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Portrait name={found?.name ?? "?"} size={44} ring={kendime ? C.gold : C.green} glow />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt weight="extrabold" size={14} color="#fff" numberOfLines={1}>{found?.name ?? "—"}</Txt>
                      <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>
                        ID {idTrim}{kendime ? " · kendi hesabın" : ""}
                      </Txt>
                    </View>
                  </View>

                  <View style={styles.ayirici} />

                  <Satir etiket="Tutar" deger={`$${usd.toFixed(2)}`} />
                  {kendime && <Satir etiket={`Kesinti (%${(SELF_FEE * 100).toFixed(0)})`} deger={`−$${kesintiUSD.toFixed(2)}`} renk={C.red} />}
                  <Satir etiket="Net" deger={`$${netUSD.toFixed(2)}`} kalin />

                  <View style={styles.ayirici} />

                  <View style={{ alignItems: "center", paddingTop: 4 }}>
                    <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.6 }}>HESABA GEÇECEK</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <DiamondBadge size={22} />
                      <Txt weight="displayBold" size={26} color="#67E8F9">{netElmas.toLocaleString("tr-TR")}</Txt>
                    </View>
                  </View>
                </View>

                <View style={styles.uyari}>
                  <Icon name="warn" size={14} color={C.gold2} />
                  <Txt weight="semibold" size={10.5} color={C.dim} lh={1.5} style={{ flex: 1 }}>
                    Onayladığında bakiye anında geçer ve işlem geri alınamaz.
                  </Txt>
                </View>

                <Pressable onPress={gonder} style={styles.anaBtnSarma}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.anaBtn}>
                    <Icon name="check" size={16} sw={2.6} color="#241A05" />
                    <Txt weight="extrabold" size={13.5} color="#241A05">Onayla ve Gönder</Txt>
                  </Gradient>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAware>
      </SafeAreaView>
    </View>
  );
}

/** Özet/başarı kartındaki tek satır. */
function Satir({ etiket, deger, renk, kalin }: { etiket: string; deger: string; renk?: string; kalin?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5 }}>
      <Txt weight={kalin ? "extrabold" : "semibold"} size={kalin ? 12.5 : 11.5} color={kalin ? C.text : C.dim}>{etiket}</Txt>
      <View style={{ flex: 1 }} />
      <Txt weight={kalin ? "displayBold" : "bold"} size={kalin ? 14 : 12} color={renk ?? (kalin ? "#fff" : C.text)}>{deger}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.kontrol, alignItems: "center", justifyContent: "center" },
  ornekCip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: "rgba(255,255,255,.10)", backgroundColor: C.kart },

  adimSerit: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  adimCizgi: { height: 3, borderRadius: 3 },

  kazancKart: { borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.gold + "3D", overflow: "hidden" },
  etiket: { letterSpacing: 0.8, marginTop: 20, marginBottom: 8 },

  tutarKutu: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, backgroundColor: C.kontrol },
  tutarGiris: { flex: 1, padding: 0, color: C.text, fontSize: 26, fontFamily: "Sora_700Bold" },
  oranCip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.gold + "33", backgroundColor: C.gold + "12" },
  cevrimSatiri: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: C.kart },

  secenek: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: C.kart },
  secenekAcik: { borderColor: C.gold + "66", backgroundColor: C.gold + "0F" },
  secenekIkon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  idKutu: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, backgroundColor: C.kontrol },
  idGiris: { flex: 1, padding: 0, color: C.text, fontSize: 14.5, fontFamily: "PlusJakartaSans_700Bold" },
  bulunanKart: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 10, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: C.green + "40", backgroundColor: C.green + "0F" },

  ozetKart: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.10)", backgroundColor: C.kart },
  ayirici: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.12)", marginVertical: 12 },
  uyari: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.gold + "2E", backgroundColor: C.gold + "0F" },

  anaBtnSarma: { marginTop: 22, borderRadius: 15, overflow: "hidden" },
  anaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },

  basariSarma: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 },
  uyariIkon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.gold + "45", backgroundColor: C.gold + "14" },
  basariKart: { alignSelf: "stretch", marginTop: 22, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,.10)", backgroundColor: C.kart },
});
