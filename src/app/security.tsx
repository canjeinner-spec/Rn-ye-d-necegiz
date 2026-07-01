import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { Pill } from "@/components/Pill";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const PHONE = "+90 532 144 07 88";
const APP_VERSION = "1.0.0";

/** Türkçe İ/I/ı/i klavye farklarından bağımsız "sil" onay karşılaştırması. */
function normalizeSil(s: string): string {
  return s
    .trim()
    .replace(/İ/g, "i")
    .replace(/ı/g, "i")
    .toUpperCase();
}

type SocialKey = "twitter" | "apple" | "google";
const SOCIALS: { key: SocialKey; label: string; icon: string }[] = [
  { key: "twitter", label: "Twitter / X", icon: "𝕏" },
  { key: "apple", label: "Apple", icon: "" },
  { key: "google", label: "Google", icon: "G" },
];

type PhoneFlow = null | "confirm" | "code" | "done" | "error";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <>
      <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 12, letterSpacing: 0.5 }}>{label}</Txt>
      <TextInput value={value} onChangeText={onChange} secureTextEntry placeholder="••••••" placeholderTextColor={C.dim2} style={styles.pwInput} />
    </>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const { signOutApp, deleteAccountApp } = useApp();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");
  const [social, setSocial] = useState<Record<SocialKey, boolean>>({ twitter: false, apple: true, google: false });
  const anyLinked = Object.values(social).some(Boolean);

  const [flow, setFlow] = useState<PhoneFlow>(null);
  const [code, setCode] = useState("");
  const codeValid = code.replace(/\D/g, "").length === 4;

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", rep: "" });
  const [pwDone, setPwDone] = useState(false);
  const pwOk = pw.next.length >= 6 && pw.next === pw.rep && pw.cur.length >= 1;

  const startPhone = () => { haptic.light(); setFlow(anyLinked ? "confirm" : "error"); };
  const closePhone = () => { setFlow(null); setCode(""); };
  const closePw = () => { setPwOpen(false); setPw({ cur: "", next: "", rep: "" }); setPwDone(false); };
  const doLogout = async () => { haptic.success(); setLogoutOpen(false); await signOutApp(); router.replace("/onboarding"); };

  const closeDel = () => { setDelOpen(false); setDelConfirmText(""); setDelError(""); setDelBusy(false); };
  const doDelete = async () => {
    setDelError("");
    setDelBusy(true);
    try {
      await deleteAccountApp();
      haptic.success();
      setDelOpen(false);
      router.replace("/onboarding");
    } catch (e) {
      setDelBusy(false);
      setDelError(e instanceof Error ? e.message : "Hesap silinemedi. Lütfen tekrar dene.");
    }
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#15110A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Hesap & Güvenlik</Txt>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>HESAP GÜVENLİĞİ</Txt>

          <Pressable onPress={startPhone} style={styles.phoneCard}>
            <Txt size={20}>📱</Txt>
            <View style={{ flex: 1 }}>
              <Txt weight="bold" size={10.5} color={C.dim}>Kayıtlı telefon numarası</Txt>
              <Txt weight="displayBold" size={15} color={C.text} style={{ marginTop: 2 }}>{PHONE}</Txt>
              <Txt weight="semibold" size={10.5} color={C.gold} style={{ marginTop: 3 }}>Numarayı değiştir →</Txt>
            </View>
            <Icon name="chev" size={15} color={C.gold} />
          </Pressable>

          <Pressable onPress={() => { haptic.light(); setPwOpen(true); }} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: "rgba(168,85,247,.15)" }]}>
              <Icon name="lock" size={16} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="extrabold" size={12.5} color={C.text}>Şifre Güncelleme</Txt>
              <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Hesap şifreni değiştir</Txt>
            </View>
            <Icon name="chev" size={14} color={C.dim2} />
          </Pressable>

          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: "rgba(96,165,250,.15)" }]}>
              <Icon name="gear" size={16} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="extrabold" size={12.5} color={C.text}>Uygulama Sürümü</Txt>
              <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Güncel sürümü kullanıyorsun</Txt>
            </View>
            <Txt weight="bold" size={11.5} color={C.dim}>v{APP_VERSION}</Txt>
          </View>

          <Txt weight="bold" size={10.5} color={C.dim} style={[styles.sectionLbl, { marginTop: 22 }]}>BAĞLI HESAPLAR</Txt>
          {SOCIALS.map((s) => {
            const linked = social[s.key];
            return (
              <Pressable key={s.key} onPress={() => { haptic.select(); setSocial((p) => ({ ...p, [s.key]: !p[s.key] })); }} style={styles.row}>
                <View style={styles.socialIcon}>
                  <Txt weight="extrabold" size={14} color="#fff">{s.icon}</Txt>
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

          <Pressable onPress={() => { haptic.light(); setLogoutOpen(true); }} style={styles.logoutBtn}>
            <View style={[styles.rowIcon, { backgroundColor: `${C.red}1A` }]}>
              <Icon name="door" size={16} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="extrabold" size={12.5} color={C.red}>Çıkış Yap</Txt>
              <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Hesabından güvenli şekilde çık</Txt>
            </View>
            <Icon name="chev" size={14} color={`${C.red}99`} />
          </Pressable>

          <Pressable onPress={() => { haptic.light(); setDelOpen(true); }} style={styles.logoutBtn}>
            <View style={[styles.rowIcon, { backgroundColor: `${C.red}1A` }]}>
              <Icon name="trash" size={16} color={C.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt weight="extrabold" size={12.5} color={C.red}>Hesabımı Sil</Txt>
              <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Bu işlem geri alınamaz</Txt>
            </View>
            <Icon name="chev" size={14} color={`${C.red}99`} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Telefon değiştirme — ortadan açılan akış */}
      <CenterModal visible={flow === "confirm"} onClose={closePhone} dim={0.72}>
        <View style={styles.dialog}>
          <Txt weight="displayBold" size={17} color="#fff">Bağlı telefon numaranı değiştir?</Txt>
          <View style={styles.goldBox}>
            <Txt weight="bold" size={10.5} color={`${C.gold}CC`}>GÜNCEL BAĞLI NUMARAN</Txt>
            <Txt weight="displayBold" size={17} color={C.gold2} style={{ marginTop: 5 }}>{PHONE}</Txt>
          </View>
          <Txt size={11.5} color={C.dim} lh={1.55} style={{ marginTop: 14 }}>Onayladığında mevcut numarana bir doğrulama kodu göndereceğiz. Kod onaylanınca numaranı değiştirebilirsin.</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Pressable onPress={closePhone} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={() => { haptic.light(); setCode(""); setFlow("code"); }} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
              <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                <Txt weight="extrabold" size={13} color="#241A05">Onayla</Txt>
              </Gradient>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      <CenterModal visible={flow === "code"} onClose={closePhone} dim={0.72}>
        <View style={styles.dialog}>
          <Txt weight="displayBold" size={17} color="#fff">Doğrulama kodu</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
            <Txt weight="bold" size={11.5} color={C.text}>{PHONE}</Txt>
            <Txt size={11.5} color={C.dim} lh={1.55}> numarasına gönderdiğimiz 4 haneli kodu gir.</Txt>
          </View>
          <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="• • • •" placeholderTextColor={C.dim2} maxLength={4} style={[styles.codeInput, { borderColor: codeValid ? C.green : C.line }]} />
          <Pressable style={{ marginTop: 12, alignSelf: "flex-start" }}><Txt weight="bold" size={11.5} color={C.gold}>Kodu tekrar gönder</Txt></Pressable>
          <Pressable onPress={() => { haptic.success(); setFlow("done"); }} disabled={!codeValid} style={{ marginTop: 18, borderRadius: 15, overflow: "hidden", opacity: codeValid ? 1 : 0.45 }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Doğrula ve Değiştir</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      <CenterModal visible={flow === "done"} onClose={closePhone} dim={0.78}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.green}1A`, borderColor: `${C.green}66` }]}>
            <Icon name="check" size={28} sw={3} color={C.green} />
          </View>
          <Txt weight="displayBold" size={17} color="#fff">Kod doğrulandı</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.55} style={{ marginTop: 8 }}>Artık yeni telefon numaranı girebilirsin. (Mockup — bu adımda yeni numara ekranı açılır.)</Txt>
          <Pressable onPress={closePhone} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      <CenterModal visible={flow === "error"} onClose={closePhone} dim={0.72}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.red}1A`, borderColor: `${C.red}66` }]}>
            <Txt size={28}>⚠️</Txt>
          </View>
          <Txt weight="displayBold" size={16.5} color="#fff">Numara değiştirilemiyor</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.6} style={{ marginTop: 10 }}>Güvenlik nedeniyle numara değiştirmek için hesabına en az bir sosyal medya hesabı (Twitter, Apple veya Google) bağlı olmalı. Doğrulama kodu gönderilmedi.</Txt>
          <Pressable onPress={closePhone} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" }}>
            <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
              <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
            </Gradient>
          </Pressable>
        </View>
      </CenterModal>

      {/* Şifre güncelleme */}
      <CenterModal visible={pwOpen} onClose={closePw} dim={0.72}>
        <View style={styles.dialog}>
          {pwDone ? (
            <View style={{ alignItems: "center" }}>
              <View style={[styles.statusCircle, { backgroundColor: `${C.green}1A`, borderColor: `${C.green}66` }]}>
                <Icon name="check" size={28} sw={3} color={C.green} />
              </View>
              <Txt weight="displayBold" size={17} color="#fff">Şifre güncellendi</Txt>
              <Txt size={12} color={C.dim} align="center" style={{ marginTop: 8 }}>Yeni şifrenle giriş yapabilirsin.</Txt>
              <Pressable onPress={closePw} style={{ alignSelf: "stretch", marginTop: 20, borderRadius: 15, overflow: "hidden" }}>
                <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                  <Txt weight="extrabold" size={13.5} color="#241A05">Tamam</Txt>
                </Gradient>
              </Pressable>
            </View>
          ) : (
            <>
              <Txt weight="displayBold" size={17} color="#fff">Şifre Güncelleme</Txt>
              <Field label="MEVCUT ŞİFRE" value={pw.cur} onChange={(t) => setPw((p) => ({ ...p, cur: t }))} />
              <Field label="YENİ ŞİFRE" value={pw.next} onChange={(t) => setPw((p) => ({ ...p, next: t }))} />
              <Field label="YENİ ŞİFRE (TEKRAR)" value={pw.rep} onChange={(t) => setPw((p) => ({ ...p, rep: t }))} />
              {pw.rep.length > 0 && pw.next !== pw.rep && <Txt size={10.5} color={C.red} style={{ marginTop: 8 }}>Şifreler eşleşmiyor.</Txt>}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable onPress={closePw} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
                  <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
                </Pressable>
                <Pressable onPress={() => { if (pwOk) { haptic.success(); setPwDone(true); } }} disabled={!pwOk} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: pwOk ? 1 : 0.45 }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                    <Txt weight="extrabold" size={13} color="#241A05">Kaydet</Txt>
                  </Gradient>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </CenterModal>

      {/* Çıkış yap onayı */}
      <CenterModal visible={logoutOpen} onClose={() => setLogoutOpen(false)} dim={0.72}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.red}1A`, borderColor: `${C.red}66` }]}>
            <Icon name="door" size={28} color={C.red} />
          </View>
          <Txt weight="displayBold" size={17} color="#fff">Çıkış yapılsın mı?</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.6} style={{ marginTop: 8 }}>Hesabından çıkış yapacaksın. Tekrar girmek için telefon numaranla doğrulama yapman gerekecek.</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" }}>
            <Pressable onPress={() => setLogoutOpen(false)} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable onPress={doLogout} style={[styles.btn, { flex: 1, backgroundColor: `${C.red}1A`, borderWidth: 1, borderColor: `${C.red}66` }]}>
              <Txt weight="extrabold" size={13} color={C.red}>Çıkış Yap</Txt>
            </Pressable>
          </View>
        </View>
      </CenterModal>

      {/* Hesap silme onayı */}
      <CenterModal visible={delOpen} onClose={closeDel} dim={0.78}>
        <View style={[styles.dialog, { alignItems: "center" }]}>
          <View style={[styles.statusCircle, { backgroundColor: `${C.red}1A`, borderColor: `${C.red}66` }]}>
            <Icon name="warn" size={26} sw={1.8} color={C.red} />
          </View>
          <Txt weight="displayBold" size={17} color="#fff">Hesabını kalıcı olarak sil?</Txt>
          <Txt size={12} color={C.dim} align="center" lh={1.6} style={{ marginTop: 8 }}>
            Profilin, gönderilerin, mesajların ve tüm verilerin kalıcı olarak silinir. Bu işlem{" "}
            <Txt weight="bold" size={12} color={C.red}>geri alınamaz</Txt>.
          </Txt>
          <Txt weight="bold" size={10.5} color={C.dim} style={{ marginTop: 16, alignSelf: "flex-start", letterSpacing: 0.5 }}>
            Onaylamak için "SİL" yaz
          </Txt>
          <TextInput
            value={delConfirmText}
            onChangeText={setDelConfirmText}
            autoCapitalize="characters"
            placeholder="SİL"
            placeholderTextColor={C.dim2}
            style={[styles.pwInput, { textAlign: "center", letterSpacing: 2 }]}
          />
          {!!delError && <Txt size={10.5} color={C.red} style={{ marginTop: 10 }}>{delError}</Txt>}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" }}>
            <Pressable onPress={closeDel} style={[styles.btn, { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable
              onPress={doDelete}
              disabled={normalizeSil(delConfirmText) !== "SIL" || delBusy}
              style={[
                styles.btn,
                { flex: 1, backgroundColor: `${C.red}1A`, borderWidth: 1, borderColor: `${C.red}66` },
                (normalizeSil(delConfirmText) !== "SIL" || delBusy) && { opacity: 0.45 },
              ]}
            >
              <Txt weight="extrabold" size={13} color={C.red}>{delBusy ? "Siliniyor…" : "Hesabımı Sil"}</Txt>
            </Pressable>
          </View>
        </View>
      </CenterModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  sectionLbl: { letterSpacing: 0.5, marginBottom: 10 },
  phoneCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 15, backgroundColor: "rgba(27,21,48,.7)", borderWidth: 1, borderColor: `${C.gold}33` },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, padding: 13, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 22, padding: 13, borderRadius: 15, backgroundColor: `${C.red}0E`, borderWidth: 1, borderColor: `${C.red}33` },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  socialIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  goldBox: { backgroundColor: `${C.gold}0E`, borderWidth: 1, borderColor: `${C.gold}33`, borderRadius: 14, padding: 14, marginTop: 16 },
  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  codeInput: { width: "100%", marginTop: 16, backgroundColor: C.card, borderWidth: 1, borderRadius: 14, paddingVertical: 14, color: C.text, fontSize: 22, textAlign: "center", letterSpacing: 12, fontWeight: "800" },
  pwInput: { width: "100%", marginTop: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, color: C.text, fontSize: 14, fontWeight: "700" },
  statusCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
