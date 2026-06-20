import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AronMark } from "@/components/AronMark";
import { Sheet } from "@/components/Sheet";
import { Txt } from "@/components/Txt";
import { COUNTRIES, PRESET_AVATARS, REGISTERED_PHONES, type Ulke } from "@/data/onboarding";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Step = "home" | "phone" | "code" | "register";

function GoldButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ borderRadius: 15, overflow: "hidden", opacity: disabled ? 0.45 : 1 }}>
      <Gradient colors={[C.gold2, "#C8922B"]} deg={135} style={{ paddingVertical: 15, alignItems: "center" }}>
        <Txt weight="extrabold" size={14} color="#241A05">{label}</Txt>
      </Gradient>
    </Pressable>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { setGirisYapildi, setUserName, setUserPhoto } = useApp();

  const [step, setStep] = useState<Step>("home");
  const [country, setCountry] = useState<Ulke>(COUNTRIES[0]);
  const [picker, setPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [rName, setRName] = useState("");
  const [rBio, setRBio] = useState("");
  const [rGender, setRGender] = useState<"e" | "k" | null>(null);
  const [rPhoto, setRPhoto] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, "").slice(0, 10);
  const phoneValid = digits.length === 10;
  const pretty = digits.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4").trim();
  const codeValid = code.length === 6;
  const regValid = rName.trim().length >= 2 && !!rGender && !!rPhoto;

  const finish = (name?: string, photo?: string | null) => {
    haptic.success();
    if (name) setUserName(name.trim());
    if (photo) setUserPhoto(photo);
    setGirisYapildi(true);
    router.replace("/");
  };
  const verifyCode = () => {
    haptic.light();
    if (REGISTERED_PHONES.includes(digits)) finish();
    else setStep("register");
  };
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!res.canceled) setRPhoto(res.assets[0].uri);
  };

  const Back = ({ to }: { to: Step }) => (
    <Pressable onPress={() => setStep(to)} style={styles.back}>
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
                <GoldButton label="Telefon ile Devam Et" onPress={() => { haptic.light(); setStep("phone"); }} />
                <Pressable onPress={() => finish()} style={styles.altBtn}>
                  <Txt weight="bold" size={13} color={C.text}> Apple ile Devam Et</Txt>
                </Pressable>
                <Pressable onPress={() => finish()} style={styles.altBtn}>
                  <Txt weight="bold" size={13} color={C.text}>G  Google ile Devam Et</Txt>
                </Pressable>
                <Pressable onPress={() => finish()} style={{ paddingVertical: 8, alignItems: "center" }}>
                  <Txt weight="semibold" size={11.5} color={C.dim}>Misafir olarak göz at →</Txt>
                </Pressable>
              </View>
            </View>
          )}

          {step === "phone" && (
            <View style={styles.stepTop}>
              <Back to="home" />
              <View style={{ alignItems: "center" }}>
                <AronMark s={58} />
                <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: 16 }}>Telefonunla giriş yap</Txt>
                <Txt size={12} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8 }}>Numaranı gir, sana doğrulama kodu gönderelim.</Txt>
              </View>

              <View style={{ marginTop: 28 }}>
                <Txt weight="bold" size={10.5} color={C.dim} style={{ letterSpacing: 0.5 }}>TELEFON NUMARASI</Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => setPicker(true)} style={[styles.codeBtn, { borderColor: picker ? C.gold : "rgba(255,255,255,.1)" }]}>
                    <Txt size={18}>{country.flag}</Txt>
                    <Txt weight="extrabold" size={13.5} color={C.text}>{country.code}</Txt>
                    <Icon name="chev" size={13} color={C.dim} />
                  </Pressable>
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <TextInput
                      value={pretty}
                      onChangeText={setPhone}
                      keyboardType="number-pad"
                      placeholder="5XX XXX XX XX"
                      placeholderTextColor={C.dim2}
                      style={[styles.input, { borderColor: phone && !phoneValid ? C.red : "rgba(255,255,255,.1)" }]}
                    />
                    {phoneValid && <View style={{ position: "absolute", right: 12 }}><Icon name="check" size={16} sw={3} color={C.green} /></View>}
                  </View>
                </View>
                <Txt weight="semibold" size={10.5} color={phone && !phoneValid ? C.red : C.dim2} style={{ marginTop: 8 }}>
                  {phone && !phoneValid ? `${digits.length}/10 hane — 10 haneli numara gir` : "10 haneli numaranı başında 0 olmadan gir"}
                </Txt>
              </View>

              <View style={{ flex: 1 }} />
              <GoldButton label="Kod Gönder" disabled={!phoneValid} onPress={() => { haptic.light(); setCode(""); setStep("code"); }} />
            </View>
          )}

          {step === "code" && (
            <View style={styles.stepTop}>
              <Back to="phone" />
              <View style={{ alignItems: "center" }}>
                <AronMark s={58} />
                <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: 16 }}>Kodu gir</Txt>
                <Txt size={12} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8 }}>
                  <Txt weight="bold" size={12} color={C.text}>{country.flag} {country.code} {pretty}</Txt>{"\n"}numarasına gönderilen 6 haneli kodu gir.
                </Txt>
              </View>

              <View style={{ marginTop: 30 }}>
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.codeCell, { borderColor: code.length === i ? C.gold : code[i] ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.1)" }]}>
                      <Txt weight="displayBold" size={22} color={C.text}>{code[i] || ""}</Txt>
                    </View>
                  ))}
                  <TextInput
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                    keyboardType="number-pad"
                    autoFocus
                    caretHidden
                    style={[StyleSheet.absoluteFill, { opacity: 0.01, color: "transparent" }]}
                  />
                </View>
                <Pressable style={{ alignSelf: "center", marginTop: 18 }}>
                  <Txt weight="bold" size={11.5} color={C.gold}>Kodu tekrar gönder (0:42)</Txt>
                </Pressable>
                <Txt weight="semibold" size={10.5} color={C.dim2} align="center" style={{ marginTop: 14 }}>
                  Demo: kayıtlı numara 532 144 07 88 → giriş · diğerleri → kayıt
                </Txt>
              </View>

              <View style={{ flex: 1 }} />
              <GoldButton label="Doğrula" disabled={!codeValid} onPress={verifyCode} />
            </View>
          )}

          {step === "register" && (
            <ScrollView contentContainerStyle={{ padding: 30, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
              <Back to="code" />
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
              <TextInput value={rName} onChangeText={setRName} maxLength={20} placeholder="Örn: gece_yıldızı" placeholderTextColor={C.dim2}
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

              <View style={{ marginTop: 30 }}>
                <GoldButton label="Aron'a Başla" disabled={!regValid} onPress={() => finish(rName, rPhoto)} />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Sheet visible={picker} onClose={() => setPicker(false)} maxHeightRatio={0.6}>
        <Txt weight="displayBold" size={16} color="#fff" style={{ marginBottom: 10 }}>Ülke / Alan Kodu</Txt>
        {COUNTRIES.map((c) => {
          const on = c.code === country.code && c.name === country.name;
          return (
            <Pressable key={c.name} onPress={() => { setCountry(c); setPicker(false); }} style={[styles.countryRow, on && { backgroundColor: C.gold + "14" }]}>
              <Txt size={17}>{c.flag}</Txt>
              <Txt weight="semibold" size={12.5} color={C.text} style={{ flex: 1 }}>{c.name}</Txt>
              <Txt weight="extrabold" size={12.5} color={on ? C.gold : C.dim}>{c.code}</Txt>
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  stepTop: { flex: 1, paddingHorizontal: 30, paddingTop: 44 },
  back: { position: "absolute", left: 20, top: 8, zIndex: 2, width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  altBtn: { paddingVertical: 13, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.05)", alignItems: "center" },
  codeBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 50, borderRadius: 14, borderWidth: 1, backgroundColor: "rgba(255,255,255,.05)" },
  input: { height: 50, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, color: C.text, fontSize: 15, fontFamily: "PlusJakartaSans_700Bold" },
  codeCell: { flex: 1, maxWidth: 46, aspectRatio: 0.78, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.05)" },
  avatar: { width: 100, height: 100, borderRadius: 50, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2, backgroundColor: "rgba(255,255,255,.05)" },
  avatarPlus: { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: "#0A0A0F", overflow: "hidden" },
  preset: { width: 46, height: 46, borderRadius: 23, overflow: "hidden", borderWidth: 2 },
  genderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
  countryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 11, borderRadius: 11 },
});
