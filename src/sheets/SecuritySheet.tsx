import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Pill } from "@/components/Pill";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const PHONE = "+90 532 144 07 88";
type SocialKey = "twitter" | "apple" | "google";
const SOCIALS: { key: SocialKey; label: string; icon: string }[] = [
  { key: "twitter", label: "Twitter / X", icon: "𝕏" },
  { key: "apple", label: "Apple", icon: "" },
  { key: "google", label: "Google", icon: "G" },
];

type View5 = "menu" | "confirm" | "code" | "done" | "error";

export function SecuritySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [social, setSocial] = useState<Record<SocialKey, boolean>>({ twitter: false, apple: true, google: false });
  const [view, setView] = useState<View5>("menu");
  const [code, setCode] = useState("");
  const anyLinked = Object.values(social).some(Boolean);
  const codeValid = code.replace(/\D/g, "").length === 4;

  const close = () => { setView("menu"); setCode(""); onClose(); };
  const startChange = () => { haptic.light(); setView(anyLinked ? "confirm" : "error"); };

  return (
    <Sheet visible={visible} onClose={close}>
      {view === "menu" && (
        <>
          <Txt weight="displayBold" size={17} color="#fff">Hesap & Güvenlik</Txt>
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>KAYITLI TELEFON NUMARASI</Txt>
          <Pressable onPress={startChange} style={styles.phoneBtn}>
            <Txt size={20}>📱</Txt>
            <View style={{ flex: 1 }}>
              <Txt weight="displayBold" size={15} color={C.text}>{PHONE}</Txt>
              <Txt weight="semibold" size={10.5} color={C.gold} style={{ marginTop: 3 }}>Numarayı değiştir →</Txt>
            </View>
            <Icon name="chev" size={15} color={C.gold} />
          </Pressable>

          <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BAĞLI HESAPLAR</Txt>
          {SOCIALS.map((s) => {
            const linked = social[s.key];
            return (
              <Pressable key={s.key} onPress={() => { haptic.select(); setSocial((p) => ({ ...p, [s.key]: !p[s.key] })); }} style={styles.row}>
                <View style={styles.socialIcon}>
                  <Txt weight="extrabold" size={14} color="#fff">{s.icon || ""}</Txt>
                </View>
                <Txt weight="extrabold" size={12.5} color={C.text} style={{ flex: 1 }}>{s.label}</Txt>
                {linked ? (
                  <Pill bg={`${C.green}1A`} color={C.green} border={`${C.green}44`}>✓ Bağlı</Pill>
                ) : (
                  <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>Bağlı değil</Pill>
                )}
              </Pressable>
            );
          })}
          <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 10 }}>Bağlı değil olana dokununca ilgili hesaba bağlanma ekranına yönlendirilirsin.</Txt>
        </>
      )}

      {view === "confirm" && (
        <>
          <Txt weight="displayBold" size={17} color="#fff">Bağlı telefon numaranı değiştir?</Txt>
          <View style={styles.goldBox}>
            <Txt weight="bold" size={10.5} color={`${C.gold}CC`}>GÜNCEL BAĞLI NUMARAN</Txt>
            <Txt weight="displayBold" size={17} color={C.gold2} style={{ marginTop: 5 }}>{PHONE}</Txt>
          </View>
          <Txt size={11.5} color={C.dim} lh={1.55} style={{ marginTop: 14 }}>Onayladığında mevcut numarana bir doğrulama kodu göndereceğiz. Kod onaylanınca numaranı değiştirebilirsin.</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Pressable onPress={() => setView("menu")} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={() => { haptic.light(); setCode(""); setView("code"); }} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13} color="#241A05">Onayla</Txt>
              </Gradient>
            </Pressable>
          </View>
        </>
      )}

      {view === "code" && (
        <>
          <Txt weight="displayBold" size={17} color="#fff">Doğrulama kodu</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
            <Txt weight="bold" size={11.5} color={C.text}>{PHONE}</Txt>
            <Txt size={11.5} color={C.dim} lh={1.55}> numarasına gönderdiğimiz 4 haneli kodu gir.</Txt>
          </View>
          <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="• • • •" placeholderTextColor={C.dim2} maxLength={4} style={[styles.codeInput, { borderColor: codeValid ? C.green : C.line }]} />
          <Pressable style={{ marginTop: 12, alignSelf: "flex-start" }}><Txt weight="bold" size={11.5} color={C.gold}>Kodu tekrar gönder</Txt></Pressable>
          <Pressable onPress={() => { haptic.success(); setView("done"); }} disabled={!codeValid} style={{ marginTop: 18, borderRadius: 15, overflow: "hidden", opacity: codeValid ? 1 : 0.45 }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Doğrula ve Değiştir</Txt>
            </Gradient>
          </Pressable>
        </>
      )}

      {view === "done" && (
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.green}1A`, borderColor: `${C.green}66` }]}>
            <Icon name="check" size={28} sw={3} color={C.green} />
          </View>
          <Txt weight="displayBold" size={17} color="#fff">Kod doğrulandı</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.55} style={{ marginTop: 8 }}>Artık yeni telefon numaranı girebilirsin. (Mockup — bu adımda yeni numara ekranı açılır.)</Txt>
          <Pressable onPress={close} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
            </Gradient>
          </Pressable>
        </View>
      )}

      {view === "error" && (
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.red}1A`, borderColor: `${C.red}66` }]}>
            <Txt size={28}>⚠️</Txt>
          </View>
          <Txt weight="displayBold" size={16.5} color="#fff">Numara değiştirilemiyor</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.6} style={{ marginTop: 10 }}>Güvenlik nedeniyle numara değiştirmek için hesabına en az bir sosyal medya hesabı (Twitter, Apple veya Google) bağlı olmalı. Doğrulama kodu gönderilmedi.</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" }}>
            <Pressable onPress={close} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Kapat</Txt>
            </Pressable>
            <Pressable onPress={() => setView("menu")} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13} color="#241A05">Hesap Bağla</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lbl: { marginTop: 16, letterSpacing: 0.5 },
  phoneBtn: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, padding: 14, borderRadius: 15, backgroundColor: "rgba(27,21,48,.7)", borderWidth: 1, borderColor: `${C.gold}33` },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, padding: 13, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  socialIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  goldBox: { backgroundColor: `${C.gold}0E`, borderWidth: 1, borderColor: `${C.gold}33`, borderRadius: 14, padding: 14, marginTop: 16 },
  codeInput: { width: "100%", marginTop: 16, backgroundColor: C.card, borderWidth: 1, borderRadius: 14, paddingVertical: 14, color: C.text, fontSize: 22, textAlign: "center", letterSpacing: 12, fontWeight: "800" },
  statusCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
