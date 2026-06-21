import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AronMark } from "@/components/AronMark";
import { Txt } from "@/components/Txt";
import { PRESET_AVATARS } from "@/data/onboarding";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/data/remote/authRepo";
import { updateMyProfile } from "@/data/remote/profileRepo";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Step = "home" | "email" | "register";

function GoldButton({ label, disabled, loading, onPress }: { label: string; disabled?: boolean; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={{ borderRadius: 15, overflow: "hidden", opacity: disabled ? 0.45 : 1 }}>
      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 15, alignItems: "center", justifyContent: "center", minHeight: 48 }}>
        {loading ? <ActivityIndicator color="#241A05" /> : <Txt weight="extrabold" size={14} color="#241A05">{label}</Txt>}
      </Gradient>
    </Pressable>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { setGirisYapildi, setUserName, setUserPhoto, loadProfile } = useApp();

  const [step, setStep] = useState<Step>("home");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // E-posta adımı
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  // Profil tamamlama adımı
  const [rName, setRName] = useState("");
  const [rBio, setRBio] = useState("");
  const [rGender, setRGender] = useState<"e" | "k" | null>(null);
  const [rPhoto, setRPhoto] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passValid = pass.length >= 6;
  const emailFormOk = emailValid && passValid;
  const regValid = rName.trim().length >= 2 && !!rGender;

  const enterApp = async () => {
    await loadProfile();
    setGirisYapildi(true);
    router.replace("/");
  };

  const submitEmail = async () => {
    if (!emailFormOk || busy) return;
    haptic.light();
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await signUpWithEmail(email, pass);
        if (!res.session) {
          // "Confirm email" açık → kullanıcı e-postasını doğrulamalı.
          setNotice("E-postana bir doğrulama bağlantısı gönderdik. Onayladıktan sonra giriş yapabilirsin.");
          setMode("login");
          return;
        }
        haptic.success();
        setStep("register"); // oturum açık, profilini tamamla
      } else {
        await signInWithEmail(email, pass);
        haptic.success();
        await enterApp();
      }
    } catch (e: any) {
      setErr(turkishAuthError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    haptic.light();
    setErr(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      haptic.success();
      await enterApp();
    } catch (e: any) {
      setErr(turkishAuthError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const finishProfile = async () => {
    if (!regValid || busy) return;
    haptic.success();
    setErr(null);
    setBusy(true);
    try {
      await updateMyProfile({
        kullanici_adi: rName.trim(),
        biyografi: rBio.trim() || null,
        cinsiyet: rGender === "e" ? "erkek" : "kadin",
        profil_resmi: rPhoto || null,
      });
      // Anlık UI için store'u da güncelle
      setUserName(rName.trim());
      if (rPhoto) setUserPhoto(rPhoto);
      await enterApp();
    } catch (e: any) {
      setErr(turkishAuthError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!res.canceled) setRPhoto(res.assets[0].uri);
  };

  const Back = ({ to }: { to: Step }) => (
    <Pressable onPress={() => { setErr(null); setNotice(null); setStep(to); }} style={styles.back}>
      <Icon name="back" size={16} color={C.text} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Gradient colors={["#17121F", "#050507"]} deg={180} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

          {step === "home" && (
            <View style={styles.center}>
              <AronMark s={92} />
              <View style={{ flexDirection: "row", marginTop: 22 }}>
                <Txt weight="displayBold" size={30} color="#fff" style={{ letterSpacing: 3 }}>ARON </Txt>
                <Txt weight="displayBold" size={30} color={C.gold} style={{ letterSpacing: 3 }}>CHAT</Txt>
              </View>
              <Txt size={13} color={C.dim} lh={1.6} align="center" style={{ marginTop: 10 }}>
                Sesin sahnesi. Odaya gir, koltuğa otur,{"\n"}gecenin yıldızı ol.
              </Txt>
              <View style={{ width: "100%", marginTop: 40, gap: 10 }}>
                <GoldButton label="E-posta ile Devam Et" onPress={() => { haptic.light(); setErr(null); setStep("email"); }} />
                <Pressable onPress={handleGoogle} disabled={busy} style={[styles.altBtn, busy && { opacity: 0.5 }]}>
                  <Txt weight="bold" size={13} color={C.text}>G  Google ile Devam Et</Txt>
                </Pressable>
                {err && <Txt weight="semibold" size={11.5} color={C.red} align="center">{err}</Txt>}
                {notice && <Txt weight="semibold" size={11.5} color={C.green} align="center" lh={1.5}>{notice}</Txt>}
              </View>
            </View>
          )}

          {step === "email" && (
            <View style={styles.stepTop}>
              <Back to="home" />
              <View style={{ alignItems: "center" }}>
                <AronMark s={58} />
                <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: 16 }}>
                  {mode === "login" ? "Tekrar hoş geldin" : "Hesabını oluştur"}
                </Txt>
                <Txt size={12} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8 }}>
                  {mode === "login" ? "E-posta ve şifrenle giriş yap." : "E-posta ve bir şifre belirle, hemen başlayalım."}
                </Txt>
              </View>

              <View style={{ marginTop: 28 }}>
                <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>E-POSTA</Txt>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="ornek@eposta.com"
                  placeholderTextColor={C.dim2}
                  style={[styles.input, { marginTop: 8, borderColor: email && !emailValid ? C.red : "rgba(255,255,255,.1)" }]}
                />

                <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginTop: 18 }}>ŞİFRE</Txt>
                <TextInput
                  value={pass}
                  onChangeText={setPass}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="En az 6 karakter"
                  placeholderTextColor={C.dim2}
                  style={[styles.input, { marginTop: 8, borderColor: pass && !passValid ? C.red : "rgba(255,255,255,.1)" }]}
                />
                {pass && !passValid ? <Txt weight="semibold" size={10.5} color={C.red} style={{ marginTop: 8 }}>Şifre en az 6 karakter olmalı</Txt> : null}

                {err && <Txt weight="semibold" size={11.5} color={C.red} style={{ marginTop: 14 }} lh={1.5}>{err}</Txt>}
                {notice && <Txt weight="semibold" size={11.5} color={C.green} style={{ marginTop: 14 }} lh={1.5}>{notice}</Txt>}

                <Pressable onPress={() => { setErr(null); setNotice(null); setMode(mode === "login" ? "signup" : "login"); }} style={{ marginTop: 18, alignSelf: "center" }}>
                  <Txt weight="bold" size={11.5} color={C.gold}>
                    {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
                  </Txt>
                </Pressable>
              </View>

              <View style={{ flex: 1 }} />
              <GoldButton label={mode === "login" ? "Giriş Yap" : "Kayıt Ol"} disabled={!emailFormOk} loading={busy} onPress={submitEmail} />
            </View>
          )}

          {step === "register" && (
            <ScrollView contentContainerStyle={{ padding: 30, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
              <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: 8 }}>Profilini oluştur</Txt>
              <Txt size={12} color={C.dim} lh={1.5} style={{ marginTop: 8 }}>Seni nasıl görelim? Birkaç bilgi yeterli.</Txt>

              <View style={{ alignItems: "center", marginTop: 24 }}>
                <Pressable onPress={pickImage} style={[styles.avatar, { borderColor: rPhoto ? C.gold : "rgba(255,255,255,.15)" }]}>
                  {rPhoto ? <Image source={{ uri: rPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="camera" size={30} color={C.dim} />}
                  <View style={styles.avatarPlus}>
                    <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ flex: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="plus" size={15} sw={2.5} color="#241A05" />
                    </Gradient>
                  </View>
                </Pressable>
                <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 9 }}>Fotoğraf yükle veya hazır olanlardan seç</Txt>
                <View style={{ flexDirection: "row", gap: 9, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  {PRESET_AVATARS.map((u) => {
                    const on = rPhoto === u;
                    return (
                      <Pressable key={u} onPress={() => setRPhoto(u)} style={[styles.preset, { borderColor: on ? C.gold : "rgba(255,255,255,.12)" }]}>
                        <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginTop: 26 }}>KULLANICI ADI</Txt>
              <TextInput value={rName} onChangeText={setRName} maxLength={20} autoCapitalize="none" placeholder="Örn: gece_yıldızı" placeholderTextColor={C.dim2}
                style={[styles.input, { marginTop: 8, borderColor: rName && rName.trim().length < 2 ? C.red : "rgba(255,255,255,.1)" }]} />

              <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginTop: 20 }}>CİNSİYET</Txt>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                {([["e", "Erkek", "#60A5FA"], ["k", "Kadın", "#FB7185"]] as const).map(([v, lb, col]) => {
                  const on = rGender === v;
                  return (
                    <Pressable key={v} onPress={() => setRGender(v)} style={[styles.genderBtn, { backgroundColor: on ? col + "1F" : "rgba(255,255,255,.05)", borderColor: on ? col : "rgba(255,255,255,.1)" }]}>
                      <Icon name="male" size={15} color={on ? col : C.dim} />
                      <Txt weight="extrabold" size={13} color={on ? col : C.dim}>{lb}</Txt>
                    </Pressable>
                  );
                })}
              </View>

              <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5, marginTop: 20 }}>BİYOGRAFİ <Txt weight="semibold" size={10.5} color={C.dim2}>(opsiyonel)</Txt></Txt>
              <TextInput value={rBio} onChangeText={setRBio} maxLength={120} multiline placeholder="Kendinden kısaca bahset... örn: Müzik ve gece sohbetleri 🎧" placeholderTextColor={C.dim2}
                style={[styles.input, { marginTop: 8, height: 80, textAlignVertical: "top", paddingTop: 12 }]} />
              <Txt size={9.5} color={C.dim2} align="right" style={{ marginTop: 4 }}>{rBio.length}/120</Txt>

              {err && <Txt weight="semibold" size={11.5} color={C.red} style={{ marginTop: 14 }} lh={1.5}>{err}</Txt>}

              <View style={{ marginTop: 30 }}>
                <GoldButton label="Aron'a Başla" disabled={!regValid} loading={busy} onPress={finishProfile} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Supabase auth hatalarını kullanıcıya Türkçe gösterir. */
function turkishAuthError(msg?: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.";
  if (m.includes("email not confirmed")) return "E-postanı henüz doğrulamadın. Gelen kutunu kontrol et.";
  if (m.includes("rate limit") || m.includes("too many")) return "Çok fazla deneme. Biraz sonra tekrar dene.";
  if (m.includes("network") || m.includes("fetch")) return "Bağlantı hatası. İnternetini kontrol et.";
  if (m.includes("iptal")) return "İşlem iptal edildi.";
  if (m.includes("duplicate") || m.includes("unique")) return "Bu kullanıcı adı alınmış, başka bir tane dene.";
  return msg || "Bir şeyler ters gitti, tekrar dene.";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  stepTop: { flex: 1, paddingHorizontal: 30, paddingTop: 44 },
  back: { position: "absolute", left: 20, top: 8, zIndex: 2, width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  altBtn: { paddingVertical: 13, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.05)", alignItems: "center" },
  input: { height: 50, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, color: C.text, fontSize: 15, fontFamily: "PlusJakartaSans_700Bold" },
  avatar: { width: 100, height: 100, borderRadius: 50, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2, backgroundColor: "rgba(255,255,255,.05)" },
  avatarPlus: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: "#0A0A0F", overflow: "hidden" },
  preset: { width: 46, height: 46, borderRadius: 23, overflow: "hidden", borderWidth: 2 },
  genderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
});
