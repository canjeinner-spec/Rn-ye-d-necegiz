import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { Pill } from "@/components/Pill";
import { Txt } from "@/components/Txt";
import { Icon } from "@/icons/Icon";
import { haptic } from "@/lib/haptics";
import { changeMyPassword } from "@/data/remote/authRepo";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";
import { Zemin } from "@/theme/Zemin";

/**
 * Uygulama sürümü app.json'dan okunuyor. Eskiden burada "1.0.0" sabiti vardı;
 * sürüm yükseltilse bile bu ekranda hep 1.0.0 yazacaktı.
 */
const APP_VERSION = Constants.expoConfig?.version ?? "—";

/** Türkçe İ/I/ı/i klavye farklarından bağımsız "sil" onay karşılaştırması. */
function normalizeSil(s: string): string {
  return s
    .trim()
    .replace(/İ/g, "i")
    .replace(/ı/g, "i")
    .toUpperCase();
}

/**
 * Bağlı hesaplar artık GERÇEK: Supabase oturumundaki `user.identities`
 * okunuyor. Önceden yerel bir `useState` vardı — dokununca "Bağlı" yazıyor
 * ama hiçbir yere bağlanmıyordu, üstelik açılışta Apple bağlıymış gibi
 * görünüyordu.
 */
type SocialKey = "twitter" | "apple" | "google";
const SOCIALS: { key: SocialKey; label: string; icon: string }[] = [
  { key: "google", label: "Google", icon: "G" },
  { key: "apple", label: "Apple", icon: "" },
  { key: "twitter", label: "Twitter / X", icon: "𝕏" },
];


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
  const signOutApp = useApp((s) => s.signOutApp);
  const deleteAccountApp = useApp((s) => s.deleteAccountApp);
  const user = useApp((s) => s.session?.user);
  const email = user?.email ?? "";

  /**
   * Hesabın hangi yöntemlerle bağlı olduğu — oturumdaki gerçek kimlikler.
   * `email` sağlayıcısı varsa şifreyle giriş var demektir; yalnızca Google
   * ile girildiyse hesabın şifresi yoktur, "Şifre Güncelleme" anlamsız olur.
   */
  const saglayicilar = new Set((user?.identities ?? []).map((i) => i.provider));
  const sifreVar = saglayicilar.has("email");
  const telefon = user?.phone || "";


  const [logoutOpen, setLogoutOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirmText, setDelConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", rep: "" });
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const pwOk = pw.next.length >= 6 && pw.next === pw.rep && pw.cur.length >= 1;

  /** Şifreyi GERÇEKTEN değiştirir (authRepo → Supabase). */
  const savePw = async () => {
    if (!pwOk || pwBusy) return;
    setPwBusy(true); setPwErr("");
    try {
      await changeMyPassword(pw.cur, pw.next);
      haptic.success();
      setPwDone(true);
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : "Şifre değiştirilemedi.");
    } finally {
      setPwBusy(false);
    }
  };

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
      <Zemin />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="back" size={16} color={C.text} />
          </Pressable>
          <Txt weight="displayBold" size={16} color="#fff">Hesap & Güvenlik</Txt>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <Txt weight="bold" size={10.5} color={C.dim} style={styles.sectionLbl}>HESAP GÜVENLİĞİ</Txt>

          <View style={styles.group}>
            {/* Burada sabit bir telefon numarası ("+90 532 144 07 88")
                kullanıcının numarasıymış gibi yazıyordu. Oturumun gerçek
                e-postası gösteriliyor. */}
            <View style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.gold}1A` }]}>
                <Icon name="idcard" size={16} color={C.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={12.5} color={C.text}>E-posta</Txt>
                <Txt size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>{email || "—"}</Txt>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Telefon: oturumda numara yoksa "Bağlı değil". Google ile
                girenlerde numara olmaz. */}
            <View style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: telefon ? `${C.gold}1A` : "rgba(255,255,255,.06)" }]}>
                <Icon name="phone" size={16} color={telefon ? C.gold : C.dim} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="extrabold" size={12.5} color={C.text}>Telefon Numarası</Txt>
                <Txt size={10} color={C.dim} numberOfLines={1} style={{ marginTop: 2 }}>
                  {telefon || "Hesabına telefon numarası bağlı değil"}
                </Txt>
              </View>
              {!telefon && (
                <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>Bağlı değil</Pill>
              )}
            </View>

            <View style={styles.divider} />

            {/* Şifre: yalnızca e-posta+şifre ile kurulmuş hesaplarda anlamlı.
                Sadece Google/Apple ile girildiyse hesabın şifresi yok. */}
            {sifreVar ? (
              <Pressable onPress={() => { haptic.light(); setPwOpen(true); }} style={[styles.row, styles.rowInGroup]}>
                <View style={[styles.rowIcon, { backgroundColor: `${C.gold}1A` }]}>
                  <Icon name="lock" size={16} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>Şifre Güncelleme</Txt>
                  <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Hesap şifreni değiştir</Txt>
                </View>
                <Icon name="chev" size={14} color={C.dim2} />
              </Pressable>
            ) : (
              <View style={[styles.row, styles.rowInGroup]}>
                <View style={[styles.rowIcon, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                  <Icon name="lock" size={16} color={C.dim} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="extrabold" size={12.5} color={C.text}>Şifre Güncelleme</Txt>
                  <Txt size={10} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>
                    Hesabına şifre tanımlı değil — {saglayicilar.has("google") ? "Google" : saglayicilar.has("apple") ? "Apple" : "sosyal hesap"} ile giriş yapıyorsun.
                  </Txt>
                </View>
                <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>Bağlı değil</Pill>
              </View>
            )}

            <View style={styles.divider} />

            <View style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: "rgba(255,255,255,.06)" }]}>
                <Icon name="gear" size={16} color={C.dim} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="extrabold" size={12.5} color={C.text}>Uygulama Sürümü</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Güncel sürümü kullanıyorsun</Txt>
              </View>
              <Txt weight="bold" size={11.5} color={C.dim}>v{APP_VERSION}</Txt>
            </View>
          </View>

          <Txt weight="bold" size={10.5} color={C.dim} style={[styles.sectionLbl, { marginTop: 22 }]}>BAĞLI HESAPLAR</Txt>
          <View style={styles.group}>
            {SOCIALS.map((s, i) => {
              const linked = saglayicilar.has(s.key);
              return (
                <View key={s.key}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={[styles.row, styles.rowInGroup]}>
                    <View style={[styles.socialIcon, linked && { borderColor: C.green + "55", backgroundColor: C.green + "12" }]}>
                      <Txt weight="extrabold" size={14} color={linked ? C.green : C.dim}>{s.icon || s.label[0]}</Txt>
                    </View>
                    <Txt weight="extrabold" size={12.5} color={linked ? C.text : C.dim} style={{ flex: 1 }}>{s.label}</Txt>
                    {linked ? (
                      <View style={styles.bagliHap}>
                        <Icon name="check" size={10} sw={3} color={C.green} />
                        <Txt weight="extrabold" size={10} color={C.green}>Bağlı</Txt>
                      </View>
                    ) : (
                      <Pill bg="rgba(255,255,255,.05)" color={C.dim} border={C.line}>Bağlı değil</Pill>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <Txt size={10} color={C.dim2} lh={1.5} style={{ marginTop: 10 }}>
            Bağlı hesaplar oturumundan okunur. Yeni hesap bağlama henüz açık değil.
          </Txt>

          <Txt weight="bold" size={10.5} color={C.red} style={[styles.sectionLbl, { marginTop: 22 }]}>TEHLİKELİ BÖLGE</Txt>
          <View style={[styles.group, styles.dangerGroup]}>
            <Pressable onPress={() => { haptic.light(); setLogoutOpen(true); }} style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.red}1A` }]}>
                <Icon name="door" size={16} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="extrabold" size={12.5} color={C.red}>Çıkış Yap</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Hesabından güvenli şekilde çık</Txt>
              </View>
              <Icon name="chev" size={14} color={`${C.red}99`} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable onPress={() => { haptic.light(); setDelOpen(true); }} style={[styles.row, styles.rowInGroup]}>
              <View style={[styles.rowIcon, { backgroundColor: `${C.red}1A` }]}>
                <Icon name="trash" size={16} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt weight="extrabold" size={12.5} color={C.red}>Hesabımı Sil</Txt>
                <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>Bu işlem geri alınamaz</Txt>
              </View>
              <Icon name="chev" size={14} color={`${C.red}99`} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Sahte telefon doğrulama akışı kaldırıldı: sabit bir numara
          gösteriyor, girilen 4 haneli kodu doğrulamadan kabul ediyor ve
          sonunda Mockup yazan bir ekranla bitiyordu. Gerçek telefon
          doğrulaması (Supabase phone auth) kurulunca geri gelecek. */}
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
              {!!pwErr && <Txt size={10.5} color={C.red} lh={1.4} style={{ marginTop: 8 }}>{pwErr}</Txt>}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable onPress={closePw} disabled={pwBusy} style={[styles.btn, { flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" }]}>
                  <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
                </Pressable>
                <Pressable onPress={savePw} disabled={!pwOk || pwBusy} style={{ flex: 1, borderRadius: 14, overflow: "hidden", opacity: pwOk && !pwBusy ? 1 : 0.45 }}>
                  <Gradient colors={[C.gold2, "#C8922B"]} deg={90} style={styles.btn}>
                    <Txt weight="extrabold" size={13} color="#241A05">{pwBusy ? "Kaydediliyor…" : "Kaydet"}</Txt>
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
            <Pressable onPress={() => setLogoutOpen(false)} style={[styles.btn, { flex: 1, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" }]}>
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
            <Pressable onPress={closeDel} style={[styles.btn, { flex: 1, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)" }]}>
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
  group: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  dangerGroup: { borderColor: `${C.red}2E` },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 58 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  rowInGroup: { marginTop: 0 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bagliHap: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(52,211,153,.12)", borderWidth: 1, borderColor: "rgba(52,211,153,.34)" },
  socialIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  dialog: { borderRadius: 24, padding: 20, backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(255,255,255,.16)" },
  pwInput: { width: "100%", marginTop: 8, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, color: C.text, fontSize: 14, fontWeight: "700" },
  statusCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
