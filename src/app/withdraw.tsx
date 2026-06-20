import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DiamondBadge } from "@/components/Coins";
import { Pill } from "@/components/Pill";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import { CenterModal } from "@/components/CenterModal";
import { ID_DIRECTORY, SELF_FEE, USD_TO_DIAMOND } from "@/data/withdraw";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const MY_ID = "4407";
const EARNINGS = 142.5;

export default function WithdrawScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const usd = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const tooMuch = usd > EARNINGS;
  const idTrim = toId.trim();
  const found = idTrim.length >= 3 ? ID_DIRECTORY[idTrim] : undefined;
  const selfTransfer = idTrim === MY_ID;
  const feeUSD = selfTransfer ? usd * SELF_FEE : 0;
  const netUSD = usd - feeUSD;
  const netDiamonds = Math.floor(netUSD * USD_TO_DIAMOND);
  const canSend = usd > 0 && !tooMuch && !!found;

  const submit = () => {
    if (!canSend) return;
    haptic.medium();
    setConfirm(true);
  };
  const finish = () => { haptic.success(); setConfirm(false); setDone(true); };

  return (
    <View style={styles.root}>
      <Gradient colors={["#0C2A1E", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Icon name="back" size={16} color={C.text} />
            </Pressable>
            <Txt weight="displayBold" size={17} color="#fff">Para Çek</Txt>
            <View style={{ flex: 1 }} />
            <Pill bg={`${C.green}14`} color={C.green} border={`${C.green}44`}>Kazanç: ${EARNINGS.toFixed(2)}</Pill>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Txt size={11.5} color={C.dim} lh={1.5}>
              Dolar kazancını istediğin ID'ye gönder. Karşılığı o hesaba <Txt size={11.5} weight="bold" color="#5EEAD4">elmas</Txt> olarak anında geçer.
            </Txt>

            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>GÖNDERİLECEK TUTAR (USD)</Txt>
            <View style={{ position: "relative", marginTop: 7 }}>
              <Txt weight="extrabold" size={15} color={C.dim} style={styles.dollarSign}>$</Txt>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.dim2}
                style={[styles.input, { paddingLeft: 28, borderColor: tooMuch ? C.red : C.line }]}
              />
            </View>
            {tooMuch && <Txt size={10.5} color={C.red} style={{ marginTop: 6 }}>Kazancından fazla gönderemezsin.</Txt>}
            {usd > 0 && !tooMuch && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 }}>
                <Txt size={10.5} color={C.dim}>≈ karşılığı</Txt>
                <DiamondBadge size={12} />
                <Txt weight="bold" size={10.5} color="#5EEAD4">{Math.floor(usd * USD_TO_DIAMOND).toLocaleString("tr-TR")}</Txt>
                <Txt size={10.5} color={C.dim}>elmas</Txt>
              </View>
            )}

            <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>ALICI HESAP ID</Txt>
            <TextInput
              value={toId}
              onChangeText={setToId}
              keyboardType="number-pad"
              placeholder="Örn: 8821"
              placeholderTextColor={C.dim2}
              style={[styles.input, { marginTop: 7, borderColor: found ? C.green : idTrim.length >= 3 ? C.red : C.line }]}
            />

            {found && (
              <View style={[styles.foundCard, { borderColor: `${selfTransfer ? C.gold : C.green}40` }]}>
                <Portrait name={found.name} size={40} ring={selfTransfer ? C.gold : C.green} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={13} color={C.text}>{found.name}</Txt>
                  <Txt weight="semibold" size={10.5} color={C.dim} style={{ marginTop: 2 }}>ID: {idTrim} · LV.{found.lv}</Txt>
                </View>
                {selfTransfer ? (
                  <Pill bg={`${C.gold}1A`} color={C.gold2} border={`${C.gold}44`}>KENDİ HESABIN</Pill>
                ) : (
                  <Icon name="check" size={18} color={C.green} />
                )}
              </View>
            )}
            {!found && idTrim.length >= 3 && (
              <Txt size={10.5} color={C.red} style={{ marginTop: 6 }}>Bu ID'ye sahip kullanıcı bulunamadı.</Txt>
            )}

            {selfTransfer && usd > 0 && (
              <View style={styles.feeBox}>
                <Txt weight="extrabold" size={11} color={C.gold2}>⚠️ Kendi hesabına çekim</Txt>
                <Txt size={10.5} color={`${C.gold}CC`} lh={1.5} style={{ marginTop: 4 }}>
                  Kendi ID'ne çekimde %{(SELF_FEE * 100).toFixed(0)} işlem kesintisi uygulanır.
                </Txt>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Txt size={11} color={C.dim}>Kesinti (%{(SELF_FEE * 100).toFixed(0)})</Txt>
                  <Txt weight="bold" size={11} color={C.red}>−${feeUSD.toFixed(2)}</Txt>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Txt weight="bold" size={12.5} color={C.text}>Net</Txt>
                  <Txt weight="displayBold" size={12.5} color={C.green}>${netUSD > 0 ? netUSD.toFixed(2) : "0.00"}</Txt>
                </View>
              </View>
            )}

            <Pressable onPress={submit} disabled={!canSend} style={[styles.sendBtn, { opacity: canSend ? 1 : 0.5 }]}>
              <Gradient colors={[C.green, "#059669"]} deg={90} style={styles.sendInner}>
                <Txt weight="extrabold" size={13.5} color="#04231A">Para Çek</Txt>
              </Gradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CenterModal visible={confirm && !!found && !done} onClose={() => setConfirm(false)} dim={0.75}>
        <View style={styles.dialog}>
          <Txt weight="bold" size={12.5} color={C.dim} align="center">Çekimi Onayla</Txt>
          {found && (
            <View style={{ alignItems: "center", gap: 8, marginTop: 16 }}>
              <Portrait name={found.name} size={68} ring={C.gold} glow />
              <Txt weight="displayBold" size={17} color="#fff">{found.name}</Txt>
              <Txt size={11} color={C.dim}>ID: {idTrim} · LV.{found.lv}</Txt>
            </View>
          )}
          <View style={styles.amountBox}>
            <Txt weight="bold" size={10.5} color={C.dim}>Gönderilecek tutar</Txt>
            <Txt weight="displayBold" size={30} color="#fff" style={{ marginTop: 4 }}>${netUSD.toFixed(2)}</Txt>
            <View style={styles.hr} />
            <Txt weight="bold" size={10.5} color={C.dim}>Karşılığı (hesabına geçecek)</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
              <DiamondBadge size={22} />
              <Txt weight="displayBold" size={24} color="#5EEAD4">{netDiamonds.toLocaleString("tr-TR")}</Txt>
            </View>
            {selfTransfer && <Txt weight="semibold" size={9.5} color={C.gold2} align="center" style={{ marginTop: 8 }}>%{(SELF_FEE * 100).toFixed(0)} kesinti sonrası</Txt>}
          </View>
          <Txt size={10.5} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 8 }}>
            Onayladığında bakiye anında karşı tarafa geçer ve geri alınamaz.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <Pressable onPress={() => setConfirm(false)} style={[styles.dlgBtn, { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={finish} style={{ flex: 1.4, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.green, "#059669"]} deg={90} style={styles.dlgBtn}>
                <Txt weight="extrabold" size={13} color="#04231A">Onayla & Gönder</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      <CenterModal visible={done} onClose={() => router.back()} dim={0.8}>
        <View style={styles.dialog}>
          <View style={styles.successIcon}>
            <Icon name="check" size={32} sw={3} color="#04231A" />
          </View>
          <Txt weight="displayBold" size={18} color="#fff" align="center">Çekim Tamam!</Txt>
          {found && (
            <Txt size={12.5} color={C.dim} align="center" lh={1.5} style={{ marginTop: 8 }}>
              ${netUSD.toFixed(2)} karşılığı {netDiamonds.toLocaleString("tr-TR")} elmas {found.name} hesabına gönderildi.
            </Txt>
          )}
          <Pressable onPress={() => router.back()} style={{ marginTop: 20, borderRadius: 14, overflow: "hidden" }}>
            <Gradient colors={[C.green, "#059669"]} deg={90} style={[styles.dlgBtn, { paddingVertical: 14 }]}>
              <Txt weight="extrabold" size={13} color="#04231A">Tamam</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  lbl: { marginTop: 16, letterSpacing: 0.5 },
  input: { width: "100%", backgroundColor: C.card, borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, color: C.text, fontSize: 14, fontWeight: "700" },
  dollarSign: { position: "absolute", left: 14, top: 15, zIndex: 1 },
  foundCard: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 10, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13 },
  feeBox: { marginTop: 10, backgroundColor: `${C.gold}0E`, borderWidth: 1, borderColor: `${C.gold}33`, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 13 },
  sendBtn: { marginTop: 18, borderRadius: 15, overflow: "hidden" },
  sendInner: { paddingVertical: 14, alignItems: "center" },
  dialog: { borderRadius: 26, padding: 24, backgroundColor: "#15131B", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  amountBox: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)", alignItems: "center" },
  hr: { height: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,.1)", marginVertical: 12 },
  dlgBtn: { paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignSelf: "center", marginBottom: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.green },
});
