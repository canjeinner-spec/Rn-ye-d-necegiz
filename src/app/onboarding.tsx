import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Alan } from "@/components/Alan";
import { LoginBackground } from "@/components/LoginBackground";

import { AronMark } from "@/components/AronMark";
import { IntroCarousel } from "@/components/IntroCarousel";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Txt } from "@/components/Txt";
import { PRESET_AVATARS } from "@/data/onboarding";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/data/remote/authRepo";
import { getMyProfile, updateMyProfile } from "@/data/remote/profileRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { epostaKontrol, kullaniciAdiKontrol, sifreGucu } from "@/lib/authValidation";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

type Step = "home" | "email" | "register";

/** Şifre gücü — dolu kademe sayısı skoru, sağda en yakın iki eksik. */
function GucCubugu({ g }: { g: ReturnType<typeof sifreGucu> }) {
  return (
    <View style={{ marginTop: 11 }}>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < g.skor ? g.renk : "rgba(255,255,255,.08)" }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
        <Txt weight="extrabold" size={10.5} color={g.renk}>{g.etiket}</Txt>
        {g.ipuclari.length > 0 && (
          <Txt size={10} color={C.dim2} numberOfLines={1} align="right" style={{ flex: 1 }}>{g.ipuclari.join(" · ")}</Txt>
        )}
      </View>
    </View>
  );
}

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
  const { girisYapildi, profilEksik, setGirisYapildi, setUserName, setUserPhoto, loadProfile } = useApp();

  const [step, setStep] = useState<Step>("home");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // E-posta adımı
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [gorunur, setGorunur] = useState(false);
  /** E-posta hatası yazarken değil, alandan çıkınca gösterilsin. */
  const [epostaDokunuldu, setEpostaDokunuldu] = useState(false);

  // Profil tamamlama adımı
  const [rName, setRName] = useState("");
  const [rBio, setRBio] = useState("");
  const [rGender, setRGender] = useState<"e" | "k" | null>(null);
  const [rPhoto, setRPhoto] = useState<string | null>(null);
  const [rBase64, setRBase64] = useState<string | null>(null); // yüklenecek görselin base64'ü (preset'te null)
  const [adDokunuldu, setAdDokunuldu] = useState(false);

  const kayit = mode === "signup";

  // Girişte YALNIZCA biçim kontrolü yapılır: eleme kuralları sonradan geldi,
  // eski hesaplar (ör. rakamla başlayan bir adres) kendi hesabına giremezse
  // kilitlenirdi. Sıkı eleme sadece yeni kayıtta.
  const bicimOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const epostaSonuc = kayit
    ? epostaKontrol(email)
    : { ok: bicimOk, hata: bicimOk ? undefined : "Geçerli bir e-posta adresi gir." };
  const epostaHata = epostaDokunuldu && email.trim().length > 0 && !epostaSonuc.ok ? epostaSonuc.hata : null;

  const guc = sifreGucu(pass, email);
  const sifreOk = kayit ? guc.yeterli : pass.length >= 6;
  const tekrarOk = !kayit || (pass2.length > 0 && pass2 === pass);
  const emailFormOk = epostaSonuc.ok && sifreOk && tekrarOk;

  /** Giriş ↔ kayıt geçişi: karşı moda ait alanlar ve uyarılar temizlenir. */
  const modDegistir = () => {
    haptic.light();
    setErr(null);
    setNotice(null);
    setPass2("");
    setEpostaDokunuldu(false);
    setMode(kayit ? "login" : "signup");
  };
  const adSonuc = kullaniciAdiKontrol(rName);
  const adHata = adDokunuldu && rName.trim().length > 0 && !adSonuc.ok ? adSonuc.hata : null;
  const regValid = adSonuc.ok && !!rGender;

  const enterApp = async () => {
    await loadProfile();
    setGirisYapildi(true);
    router.replace("/");
  };

  // Auth sonrası: profil hâlâ stub (user_1234567) ise profil tamamlamaya
  // yönlendir (özellikle Google girişinde register adımı atlanmıştı), değilse gir.
  const proceedAfterAuth = async () => {
    const profile = await getMyProfile().catch((e) => {
      console.log("[auth] getMyProfile HATA:", e?.message || e);
      return null;
    });
    console.log("[auth] profil:", profile ? `id=${profile.id} ad=${profile.kullanici_adi}` : "YOK (null)");
    if (profile && /^user_\d+$/.test(profile.kullanici_adi || "")) {
      console.log("[auth] -> register adimi (profil tamamlanmamis)");
      setStep("register");
    } else {
      console.log("[auth] -> uygulamaya giriliyor");
      await enterApp();
      console.log("[auth] enterApp bitti");
    }
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
        await proceedAfterAuth();
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
      const sess = await signInWithGoogle();
      console.log("[auth] Google oturum:", sess?.session ? "KURULDU" : "YOK");
      haptic.success();
      await proceedAfterAuth();
    } catch (e: any) {
      console.log("[auth] Google HATA:", e?.message || e);
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
      // Çekilen görseli Storage'a yükle; preset avatarlar zaten https URL.
      // DB'ye yalnızca https URL yazılır — file:// (yerel) ASLA kaydedilmez.
      let photoUrl: string | null = rPhoto && /^https?:\/\//.test(rPhoto) ? rPhoto : null;
      if (rPhoto && rBase64 && isSupabaseConfigured) {
        try { photoUrl = await uploadAvatar(rBase64, rPhoto); } catch { /* yüklenemezse DB'ye yazma */ }
      }
      await updateMyProfile({
        kullanici_adi: rName.trim(),
        biyografi: rBio.trim() || null,
        cinsiyet: rGender, // DB: varchar(1) CHECK IN ('e','k')
        profil_resmi: photoUrl,
      });
      // Anlık UI için store'u da güncelle (yerel önizleme dahil)
      setUserName(rName.trim());
      if (photoUrl || rPhoto) setUserPhoto(photoUrl || rPhoto);
      await enterApp();
    } catch (e: any) {
      setErr(turkishAuthError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (!res.canceled) { setRPhoto(res.assets[0].uri); setRBase64(res.assets[0].base64 ?? null); }
  };

  const Back = ({ to }: { to: Step }) => (
    <Pressable onPress={() => { setErr(null); setNotice(null); setStep(to); }} style={styles.back}>
      <Icon name="back" size={16} color={C.text} />
    </Pressable>
  );

  // Girişli ama profili stub (user_1234567) → hangi yoldan gelinirse gelinsin
  // (soğuk açılış dahil) profil tamamlama adımına al. Root AuthGate bu kişiyi
  // onboarding'de tutar; burada register'a çeviriyoruz.
  useEffect(() => {
    if (girisYapildi && profilEksik === true && step === "home" && !busy) setStep("register");
  }, [girisYapildi, profilEksik, step, busy]);

  // Açılışta zaten girişli VE profili tam ise ana ekrana git. Profil yüklenene
  // (profilEksik null) ya da stub olduğu (true) sürece yönlendirme yapma; busy
  // iken (Google akışı sürerken) de bekle. Asıl güvenilir sürücü root AuthGate.
  if (girisYapildi && profilEksik === false && step === "home" && !busy) return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      {/* Düz gradyan yerine üç katmanlı hareketli sahne */}
      <LoginBackground />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>

          {step === "home" && (
            <View style={styles.home}>
              <Animated.View entering={FadeIn.duration(600)} style={styles.brand}>
                <AronMark s={62} />
                <View style={{ flexDirection: "row", marginTop: 14 }}>
                  <Txt weight="displayBold" size={26} color="#fff" style={{ letterSpacing: 3 }}>ARON </Txt>
                  <Txt weight="displayBold" size={26} color={C.gold} style={{ letterSpacing: 3 }}>CHAT</Txt>
                </View>
              </Animated.View>

              <Animated.View entering={FadeIn.delay(150).duration(700)} style={{ flex: 1 }}>
                <IntroCarousel />
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(250).duration(600)} style={styles.homeFooter}>
                <GoldButton label="E-posta ile Devam Et" onPress={() => { haptic.light(); setErr(null); setStep("email"); }} />
                <Pressable onPress={handleGoogle} disabled={busy} style={[styles.altBtn, busy && { opacity: 0.5 }]}>
                  {/* Metnin içine kaçmış "G" harfi yerine gerçek bir rozet. */}
                  <View style={styles.gRozet}>
                    <Txt weight="displayBold" size={12} color="#1B1B1F">G</Txt>
                  </View>
                  <Txt weight="bold" size={13} color={C.text}>Google ile Devam Et</Txt>
                </Pressable>
                {err && <Txt weight="semibold" size={11.5} color={C.red} align="center">{err}</Txt>}
                {notice && <Txt weight="semibold" size={11.5} color={C.green} align="center" lh={1.5}>{notice}</Txt>}
              </Animated.View>
            </View>
          )}

          {step === "email" && (
            <ScrollView contentContainerStyle={styles.stepTop} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Back to="home" />

              <View style={{ alignItems: "center" }}>
                <AronMark s={60} />
                {/* Kayıt iki adımlı; kullanıcı nerede olduğunu görsün. */}
                {kayit && (
                  <View style={styles.adimRozet}>
                    <Txt weight="extrabold" size={9.5} color={C.gold2} style={{ letterSpacing: 1 }}>ADIM 1 / 2</Txt>
                  </View>
                )}
                <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: kayit ? 12 : 16 }}>
                  {kayit ? "Hesabını oluştur" : "Tekrar hoş geldin"}
                </Txt>
                <Txt size={12} color={C.dim} lh={1.5} align="center" style={{ marginTop: 8, maxWidth: 280 }}>
                  {kayit
                    ? "E-posta ve güçlü bir şifre belirle. Sıradaki adımda profilini kuracağız."
                    : "E-posta ve şifrenle kaldığın yerden devam et."}
                </Txt>
              </View>

              <View style={{ marginTop: 24 }}>
                <Alan
                  etiket="E-POSTA"
                  deger={email}
                  degistir={setEmail}
                  placeholder="ornek@eposta.com"
                  klavye="email-address"
                  hata={epostaHata}
                  odakDegisti={(o) => { if (!o) setEpostaDokunuldu(true); }}
                />

                <Alan
                  etiket="ŞİFRE"
                  deger={pass}
                  degistir={setPass}
                  placeholder={kayit ? "En az 8 karakter" : "Şifren"}
                  gizli
                  gorunur={gorunur}
                  gozBas={() => setGorunur(!gorunur)}
                  hata={!kayit && pass.length > 0 && pass.length < 6 ? "Şifre en az 6 karakter." : null}
                />
                {kayit && pass.length > 0 && <GucCubugu g={guc} />}

                {/* Kayıtta şifre tekrarı — girişte yok, iki ekran birbirinin
                    kopyası gibi durmasın ve yanlış yazılan şifreyle hesap
                    açılmasın. */}
                {kayit && (
                  <Alan
                    etiket="ŞİFRE TEKRAR"
                    deger={pass2}
                    degistir={setPass2}
                    placeholder="Şifreni bir daha yaz"
                    gizli
                    gorunur={gorunur}
                    hata={pass2.length > 0 && pass2 !== pass ? "Şifreler eşleşmiyor." : null}
                    sagRozet={pass2.length > 0 && pass2 === pass ? <Icon name="check" size={16} color={C.green} /> : undefined}
                  />
                )}

                {err && <Txt weight="semibold" size={11.5} color={C.red} style={{ marginTop: 16 }} lh={1.5}>{err}</Txt>}
                {notice && <Txt weight="semibold" size={11.5} color={C.green} style={{ marginTop: 16 }} lh={1.5}>{notice}</Txt>}

                <Pressable onPress={modDegistir} style={styles.gecisBtn}>
                  <Txt size={11.5} color={C.dim}>{kayit ? "Zaten hesabın var mı? " : "Hesabın yok mu? "}</Txt>
                  <Txt weight="extrabold" size={11.5} color={C.gold}>{kayit ? "Giriş yap" : "Kayıt ol"}</Txt>
                </Pressable>
              </View>

              {/* Buton dipte kalsın; kayıtta alanlar uzayınca içerik kayar. */}
              <View style={{ flex: 1, minHeight: 26 }} />
              <GoldButton label={kayit ? "Kayıt Ol" : "Giriş Yap"} disabled={!emailFormOk} loading={busy} onPress={submitEmail} />
            </ScrollView>
          )}

          {step === "register" && (
            <ScrollView contentContainerStyle={styles.kayitScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[styles.adimRozet, { alignSelf: "flex-start", marginTop: 4 }]}>
                <Txt weight="extrabold" size={9.5} color={C.gold2} style={{ letterSpacing: 1 }}>ADIM 2 / 2</Txt>
              </View>
              <Txt weight="displayBold" size={21} color="#fff" style={{ marginTop: 12 }}>Profilini oluştur</Txt>
              <Txt size={12} color={C.dim} lh={1.5} style={{ marginTop: 8 }}>Odalarda seni bu bilgilerle görecekler.</Txt>

              {/* Ekranın odağı avatar: küçük bir daire + altına sıkışmış altı
                  yuvarlak yerine, altın halkalı büyük avatar ve altında yazdıkça
                  güncellenen ad önizlemesi. */}
              <View style={{ alignItems: "center", marginTop: 26 }}>
                <Pressable onPress={pickImage} style={styles.avatarWrap}>
                  <Gradient
                    colors={rPhoto ? [C.gold2, "#B4802A"] : ["rgba(255,255,255,.18)", "rgba(255,255,255,.05)"]}
                    deg={135}
                    style={styles.avatarHalka}
                  >
                    <View style={styles.avatar}>
                      {rPhoto
                        ? <Image source={{ uri: rPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        : <Icon name="camera" size={26} color={C.dim} />}
                    </View>
                  </Gradient>
                  <View style={styles.camBadge}>
                    <Icon name="camera" size={13} sw={2} color="#241A05" />
                  </View>
                </Pressable>

                <Txt weight="displayBold" size={15} color={rName.trim() ? "#fff" : C.dim2} numberOfLines={1} style={{ marginTop: 13 }}>
                  {rName.trim() || "kullanıcı adın"}
                </Txt>
                <Txt weight="semibold" size={10.5} color={C.dim2} style={{ marginTop: 3 }}>
                  {rPhoto ? "Değiştirmek için fotoğrafa dokun" : "Fotoğraf yüklemek için dokun"}
                </Txt>
              </View>

              <View style={styles.ayirici}>
                <View style={styles.cizgi} />
                <Txt weight="bold" size={9.5} color={C.dim2} style={{ letterSpacing: 1 }}>HAZIR AVATARLAR</Txt>
                <View style={styles.cizgi} />
              </View>

              {/* Sarmalanmış ızgara yerine yatay şerit — yeni avatar eklendikçe
                  ekran aşağı doğru şişmez. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
                {PRESET_AVATARS.map((u) => {
                  const on = rPhoto === u;
                  return (
                    <Pressable key={u} onPress={() => { haptic.select(); setRPhoto(u); setRBase64(null); }} style={[styles.preset, { borderColor: on ? C.gold : "rgba(255,255,255,.12)" }]}>
                      <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {on && (
                        <View style={styles.presetTik}>
                          <Icon name="check" size={10} sw={3} color="#241A05" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ marginTop: 8 }}>
                <Alan
                  etiket="KULLANICI ADI"
                  deger={rName}
                  degistir={(s) => setRName(s.slice(0, 20))}
                  placeholder="gece_yildizi"
                  hata={adHata}
                  odakDegisti={(o) => { if (!o) setAdDokunuldu(true); }}
                  solRozet={<Txt weight="extrabold" size={15} color={C.dim2} style={{ marginRight: 5 }}>@</Txt>}
                  sagRozet={<Txt weight="bold" size={10.5} color={rName.length >= 18 ? C.gold : C.dim2}>{rName.length}/20</Txt>}
                />
              </View>

              <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.7, marginTop: 22 }}>CİNSİYET</Txt>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                {/* Kadın seçeneği de erkek ikonuyla çiziliyordu; artık kendi ikonu var. */}
                {([["e", "Erkek", "#60A5FA", "male"], ["k", "Kadın", "#FB7185", "female"]] as const).map(([v, lb, col, ik]) => {
                  const on = rGender === v;
                  return (
                    <Pressable key={v} onPress={() => { haptic.select(); setRGender(v); }} style={[styles.genderBtn, { backgroundColor: on ? col + "1C" : "rgba(255,255,255,.05)", borderColor: on ? col : "rgba(255,255,255,.1)" }]}>
                      <Icon name={ik} size={16} color={on ? col : C.dim} />
                      <Txt weight="extrabold" size={13} color={on ? col : C.dim}>{lb}</Txt>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
                <Txt weight="bold" size={10} color={C.dim} style={{ letterSpacing: 0.7 }}>
                  BİYOGRAFİ <Txt weight="semibold" size={10} color={C.dim2}>· opsiyonel</Txt>
                </Txt>
                <Txt weight="bold" size={10} color={rBio.length >= 110 ? C.gold : C.dim2}>{rBio.length}/120</Txt>
              </View>
              <TextInput
                value={rBio}
                onChangeText={setRBio}
                maxLength={120}
                multiline
                placeholder="Kendinden kısaca bahset — örn: Müzik ve gece sohbetleri"
                placeholderTextColor={C.dim2}
                style={styles.bio}
              />

              {err && <Txt weight="semibold" size={11.5} color={C.red} style={{ marginTop: 16 }} lh={1.5}>{err}</Txt>}

              <View style={{ marginTop: 26 }}>
                <GoldButton label="Aron'a Başla" disabled={!regValid} loading={busy} onPress={finishProfile} />
              </View>
              <Txt size={10} color={C.dim2} align="center" lh={1.5} style={{ marginTop: 12 }}>
                Bilgilerini sonradan profilinden değiştirebilirsin.
              </Txt>
            </ScrollView>
          )}
        </KeyboardAware>
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
  home: { flex: 1 },
  brand: { alignItems: "center", paddingTop: 18 },
  homeFooter: { paddingHorizontal: 30, paddingBottom: 8, gap: 10 },
  /** Form adımı: alanlar doğrudan sahnenin üstünde durur, panel/perde yok. */
  stepTop: { flexGrow: 1, paddingHorizontal: 30, paddingTop: 44, paddingBottom: 20 },
  adimRozet: { marginTop: 14, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(232,179,65,.32)", backgroundColor: "rgba(232,179,65,.10)" },
  gecisBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 20 },
  gRozet: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: 20, top: 8, zIndex: 2, width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  altBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 13, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.05)" },
  kayitScroll: { paddingHorizontal: 30, paddingTop: 24, paddingBottom: 34 },
  bio: { minHeight: 92, marginTop: 8, borderWidth: 1, borderColor: "rgba(255,255,255,.1)", borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, backgroundColor: "rgba(255,255,255,.05)", color: C.text, fontSize: 14, lineHeight: 20, fontFamily: "PlusJakartaSans_700Bold", textAlignVertical: "top" },
  ayirici: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 26, marginBottom: 12 },
  cizgi: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,.08)" },
  avatarWrap: { width: 116, height: 116 },
  /** Altın halka: gradyan çerçeve, içindeki daire fotoğrafı kırpar. */
  avatarHalka: { width: 116, height: 116, borderRadius: 58, padding: 2.5, alignItems: "center", justifyContent: "center" },
  avatar: { width: 111, height: 111, borderRadius: 56, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#121218" },
  camBadge: { position: "absolute", right: 1, bottom: 1, width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold2, borderWidth: 3, borderColor: "#0A0A0F", alignItems: "center", justifyContent: "center" },
  preset: { width: 52, height: 52, borderRadius: 26, overflow: "hidden", borderWidth: 2 },
  presetTik: { position: "absolute", right: -1, bottom: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: C.gold2, borderWidth: 1.5, borderColor: "#0A0A0F", alignItems: "center", justifyContent: "center" },
  genderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
});
