import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CenterModal } from "@/components/CenterModal";
import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Tabs } from "@/components/Tabs";
import { Txt } from "@/components/Txt";
import {
  accountBan, accountUnban, changeEmail, changePublicId, freezeAsset, getActionHistory,
  getUserDetail, getUserHaklar, grantBalance, micBan, micUnban, resetPassword, setPlatformRole,
  setUserHak, updateUserIdentity,
  type AdminAction, type AdminUserDetail,
} from "@/data/remote/adminRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
import { type IconName } from "@/icons/paths";
import { haptic } from "@/lib/haptics";
import { useApp } from "@/store/appStore";
import { C } from "@/theme/colors";
import { Gradient } from "@/theme/Gradient";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function zaman(at: number) {
  const d = new Date(at);
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const ROLE_LABEL: Record<string, string> = { user: "Kullanıcı", developer: "Geliştirici", super_admin: "Süper Yönetici" };
const ISLEM_LABEL: Record<string, string> = {
  bakiye_ekle: "Bakiye eklendi", bakiye_dus: "Bakiye düşüldü", varlik_dondur: "Varlık donduruldu",
  varlik_coz: "Dondurma çözüldü", mic_yasak_ver: "Mic yasağı verildi", mic_yasak_kaldir: "Mic yasağı kaldırıldı",
  hesap_yasak_ver: "Hesap yasaklandı", hesap_yasak_kaldir: "Hesap yasağı kaldırıldı", rol_ata: "Rol değiştirildi",
  id_degistir: "ID değiştirildi", sifre_sifirla: "Şifre sıfırlandı", email_degistir: "E-posta değiştirildi",
  ad_degistir: "Ad değiştirildi", avatar_degistir: "Avatar değiştirildi",
};
const SECTION_TITLE: Record<string, string> = { economy: "Ekonomi", penalty: "Cezai İşlemler", identity: "Kimlik & Bilgi", history: "İşlem Geçmişi" };
/** Sekme sırası — admin-user'daki bölüm satırlarıyla aynı sırada. */
const SECTIONS = ["economy", "penalty", "identity", "history"];

const BAN_CHIPS = [["30dk", 30], ["1s", 60], ["1g", 1440], ["7g", 10080], ["Kalıcı", null], ["Manuel", "manual"]] as const;

/** Onay metninde süreyi okunur yazar (90 → "1 sa 30 dk"). */
function sureAdi(dk: number) {
  if (dk >= 1440) { const g = Math.floor(dk / 1440); const k = dk % 1440; return `${g} gün${k ? ` ${Math.round(k / 60)} sa` : ""}`; }
  if (dk >= 60) { const s = Math.floor(dk / 60); const k = dk % 60; return `${s} sa${k ? ` ${k} dk` : ""}`; }
  return `${dk} dk`;
}

/** Geri alınamaz işlemler için onay penceresi verisi. */
type Onay = { baslik: string; metin: string; btn: string; fn: () => void };

/* ── Ortak kontroller ────────────────────────────────────────────────────────
   Ekranda tek bir "chip" stili vardı ve hem SEÇİM (elmas/altın, ceza süresi,
   rol) hem AKSİYON (avatarı değiştir, hak ver, dondur) için kullanılıyordu;
   neyin seçenek neyin buton olduğu anlaşılmıyordu. Üçü artık ayrı:
   Secim = seçenek, Aksiyon = dolgulu buton, Anahtar = aç/kapa.            */

function Secim({ on, label, tint = C.gold, disabled, onPress, children }: {
  on: boolean; label: string; tint?: string; disabled?: boolean; onPress: () => void; children?: React.ReactNode;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { haptic.select(); onPress(); }}
      style={[styles.secim, on && { backgroundColor: `${tint}1F`, borderColor: `${tint}66` }, disabled && { opacity: 0.4 }]}
    >
      {children}
      <Txt weight="bold" size={11} color={on ? tint : C.dim}>{label}</Txt>
    </Pressable>
  );
}

function Aksiyon({ label, icon, tint, dolu, disabled, genis, onPress }: {
  label: string; icon?: IconName; tint: string; dolu?: boolean; disabled?: boolean; genis?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.aksiyon,
        genis ? { flex: 1 } : null,
        dolu ? { backgroundColor: tint, borderColor: tint } : { backgroundColor: `${tint}16`, borderColor: `${tint}4D` },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon && <Icon name={icon} size={14} sw={2.2} color={dolu ? "#141018" : tint} />}
      <Txt weight="extrabold" size={12.5} color={dolu ? "#141018" : tint}>{label}</Txt>
    </Pressable>
  );
}

function Anahtar({ on, disabled, onPress }: { on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.anahtar, { backgroundColor: on ? C.green : "rgba(255,255,255,.13)", alignItems: on ? "flex-end" : "flex-start" }, disabled && { opacity: 0.4 }]}>
      <View style={styles.anahtarTopuz} />
    </Pressable>
  );
}

/** Bölüm başlığı — hepsi aynı aralıkta olsun diye. */
function Baslik({ children, tint = C.dim }: { children: React.ReactNode; tint?: string }) {
  return <Txt weight="bold" size={10.5} color={tint} style={styles.lbl}>{children}</Txt>;
}

export default function AdminUserEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; section?: string }>();
  const userId = params.userId ? parseInt(String(params.userId), 10) : NaN;
  // Bölüm artık yerel state: dört bölüm ayrı sayfaydı, birinden diğerine
  // geçmek için geri gidip kullanıcıya tekrar girmek gerekiyordu. URL
  // parametresi yalnızca başlangıç bölümünü belirliyor.
  const [section, setSection] = useState(String(params.section || "economy"));
  const myRole = useApp((s) => s.role);
  const isDev = myRole === "developer";

  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [haklar, setHaklar] = useState<{ beta_tester: boolean; premium_hak: boolean; ozel_id: string | null; ozel_id_tip: string | null } | null>(null);
  const [history, setHistory] = useState<AdminAction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [onay, setOnay] = useState<Onay | null>(null);

  // girdiler
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"elmas" | "altin">("elmas");
  const [micReason, setMicReason] = useState("");
  const [micMin, setMicMin] = useState<number | null | "manual">(60);
  const [micManual, setMicManual] = useState("");
  const [accReason, setAccReason] = useState("");
  const [accMin, setAccMin] = useState<number | null | "manual">(10080);
  const [accManual, setAccManual] = useState("");
  const [newId, setNewId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newName, setNewName] = useState("");

  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2400); };
  const load = useCallback(() => {
    if (!Number.isFinite(userId)) { setErr("Kullanıcı bulunamadı."); setLoading(false); return; }
    setLoading(true); setErr(null);
    const jobs: Promise<unknown>[] = [getUserDetail(userId).then((r) => { if (r) setD(r); else setErr("Kullanıcı bulunamadı."); })];
    if (section === "identity") jobs.push(getUserHaklar(userId).then(setHaklar).catch(() => setHaklar(null)));
    if (section === "history") jobs.push(getActionHistory("kullanici", userId).then(setHistory).catch(() => setHistory([])));
    Promise.all(jobs).catch((e) => setErr((e as Error)?.message || "Bilgi alınamadı.")).finally(() => setLoading(false));
  }, [userId, section]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); flash(ok); load(); }
    catch (e) { flash((e as Error)?.message || "İşlem başarısız"); }
    finally { setBusy(false); }
  };
  const doGrant = (sign: 1 | -1) => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0 || !d) return flash("Geçerli miktar gir");
    run(() => grantBalance(d.id, asset, sign * n, "Yönetici işlemi"), `${asset === "elmas" ? "Elmas" : "Altın"} ${sign > 0 ? "eklendi" : "düşüldü"}`).then(() => setAmount(""));
  };
  const doMicBan = () => {
    if (!d) return;
    const mins = micMin === "manual" ? parseInt(micManual, 10) : micMin;
    if (micMin === "manual" && (!mins || mins <= 0)) return flash("Süre gir (dakika)");
    run(() => micBan(d.id, micReason.trim() || null, mins as number | null), "Mic yasağı verildi").then(() => setMicReason(""));
  };
  const doAccBan = () => {
    if (!d) return;
    const mins = accMin === "manual" ? parseInt(accManual, 10) : accMin;
    if (accMin === "manual" && (!mins || mins <= 0)) return flash("Süre gir (dakika)");
    // Hesap yasağı kullanıcının oturumunu kapatır ve uygulamayı tamamen
    // kilitler. Tek dokunuşla, onaysız çalışıyordu.
    setOnay({
      baslik: "Hesabı yasakla?",
      metin: `${d.name} ${mins == null ? "KALICI olarak" : `${sureAdi(mins)} boyunca`} uygulamayı hiç kullanamayacak; oturumu hemen kapatılır.`,
      btn: "Yasakla",
      fn: () => run(() => accountBan(d.id, accReason.trim() || null, mins as number | null), "Hesap yasaklandı").then(() => setAccReason("")),
    });
  };
  // Avatar: yönetici galeriden seçer → kendi storage klasörüne yükler → URL hedefe yazılır
  const doAvatar = async () => {
    if (!d || busy) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(res.assets[0].base64, res.assets[0].uri);
      await updateUserIdentity(d.id, undefined, url);
      flash("Avatar güncellendi"); load();
    } catch (e) { flash((e as Error)?.message || "Avatar yüklenemedi"); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <Gradient colors={["#16121F", "#0B0A11", "#08080C"]} deg={175} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          {/* Hangi kullanıcıyı yönettiğin her bölümde görünsün */}
          {d ? (
            <>
              <Portrait name={d.name} size={34} photo={d.photo} ring={d.rol === "user" ? undefined : C.gold} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="displayBold" size={14.5} color="#fff" numberOfLines={1}>{d.name}</Txt>
                <Txt size={10.5} color={C.dim} numberOfLines={1}>ID: {d.publicId}</Txt>
              </View>
              {(d.hesapYasakli || d.micBanned) && (
                <View style={styles.uyariRozet}>
                  <Icon name="ban" size={11} color="#FB7185" />
                  <Txt weight="extrabold" size={9} color="#FB7185">{d.hesapYasakli ? "YASAKLI" : "MİC YASAK"}</Txt>
                </View>
              )}
            </>
          ) : (
            <Txt weight="displayBold" size={16} color="#fff">{SECTION_TITLE[section] || "Düzenle"}</Txt>
          )}
        </View>

        {/* Bölümler arası geçiş — eskiden her biri ayrı sayfaydı */}
        {d && (
          <Tabs
            items={["Ekonomi", "Ceza", "Kimlik", "Geçmiş"]}
            active={SECTIONS.indexOf(section)}
            set={(i: number) => setSection(SECTIONS[i])}
            fill
            pad={14}
          />
        )}

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.gold} /></View>
        ) : err || !d ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 }}>
            <Icon name="warn" size={26} color="#FB7185" />
            <Txt size={12.5} color={C.dim} align="center" lh={1.5}>{err || "Kullanıcı bulunamadı."}</Txt>
            <Pressable onPress={load} style={[styles.chip, { paddingHorizontal: 18 }]}><Txt weight="bold" size={12} color={C.gold2}>Tekrar dene</Txt></Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!!note && <View style={styles.note}><Txt weight="bold" size={11.5} color={C.gold2} align="center">{note}</Txt></View>}

            {/* ================= EKONOMİ ================= */}
            {section === "economy" && (
              <>
                {/* Mevcut bakiye önce görünsün — ne verdiğini/aldığını
                    bilmeden işlem yapılıyordu, güncel bakiye en altta
                    küçük gri bir satırdı. */}
                <View style={[styles.group, { flexDirection: "row", marginTop: 4 }]}>
                  <View style={styles.bakiyeKutu}>
                    <DiamondBadge size={18} />
                    <Txt weight="displayBold" size={19} color={d.elmasDondu ? "#7DD3FC" : "#fff"}>{d.elmas.toLocaleString("tr-TR")}</Txt>
                    <Txt weight="bold" size={9} color={C.dim2} style={{ letterSpacing: 0.3 }}>{d.elmasDondu ? "ELMAS · DONUK" : "ELMAS"}</Txt>
                  </View>
                  <View style={styles.dikeyAyirici} />
                  <View style={styles.bakiyeKutu}>
                    <CoinBadge size={18} />
                    <Txt weight="displayBold" size={19} color={d.altinDondu ? "#FCD34D" : "#fff"}>{d.altin.toLocaleString("tr-TR")}</Txt>
                    <Txt weight="bold" size={9} color={C.dim2} style={{ letterSpacing: 0.3 }}>{d.altinDondu ? "ALTIN · DONUK" : "ALTIN"}</Txt>
                  </View>
                </View>

                <Baslik>BAKİYE VER / AL</Baslik>
                <View style={styles.group}>
                  <View style={{ padding: 13, gap: 11 }}>
                    <View style={{ flexDirection: "row", gap: 7 }}>
                      {(["elmas", "altin"] as const).map((a) => (
                        <Secim key={a} on={asset === a} label={a === "elmas" ? "Elmas" : "Altın"} onPress={() => setAsset(a)}>
                          {a === "elmas" ? <DiamondBadge size={13} /> : <CoinBadge size={13} />}
                        </Secim>
                      ))}
                    </View>
                    <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Miktar" placeholderTextColor={C.dim2} style={styles.input} />
                    <View style={{ flexDirection: "row", gap: 9 }}>
                      <Aksiyon genis dolu tint="#34D399" icon="plus" label="Ver" disabled={busy} onPress={() => doGrant(1)} />
                      <Aksiyon genis tint="#FB7185" icon="x" label="Al" disabled={busy} onPress={() => doGrant(-1)} />
                    </View>
                  </View>
                </View>

                <Baslik>DONDURMA (HARCAMA KİLİDİ)</Baslik>
                <View style={styles.group}>
                  {([["elmas", d.elmasDondu], ["altin", d.altinDondu]] as const).map(([a, frozen], i) => (
                    <View key={a}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.freezeRow}>
                        {a === "elmas" ? <DiamondBadge size={16} /> : <CoinBadge size={16} />}
                        <View style={{ flex: 1 }}>
                          <Txt weight="bold" size={12.5} color={C.text}>{a === "elmas" ? "Elmas" : "Altın"}</Txt>
                          <Txt size={10} color={frozen ? "#7DD3FC" : C.dim} style={{ marginTop: 1 }}>{frozen ? "Donduruldu — harcayamaz" : "Serbest"}</Txt>
                        </View>
                        {/* Aç/kapa durumu için buton değil anahtar */}
                        <Anahtar on={frozen} disabled={busy} onPress={() => run(() => freezeAsset(d.id, a, !frozen), frozen ? "Çözüldü" : "Donduruldu")} />
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ================= CEZAİ İŞLEMLER ================= */}
            {section === "penalty" && (
              <>
                <Baslik>MİKROFON YASAĞI</Baslik>
                {d.micBanned ? (
                  <View style={styles.group}><View style={styles.gRow}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="extrabold" size={12.5} color="#FB7185">Mikrofon yasaklı</Txt>
                      <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{d.micBitis ? `Bitiş: ${zaman(d.micBitis)}` : "Kalıcı"}{d.micSebep ? ` · ${d.micSebep}` : ""}</Txt>
                    </View>
                    <Aksiyon tint="#34D399" icon="check" label="Kaldır" disabled={busy} onPress={() => run(() => micUnban(d.id), "Yasak kaldırıldı")} />
                  </View></View>
                ) : (
                  <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {BAN_CHIPS.map(([lb, v]) => (
                        <Secim key={lb} on={micMin === v} label={lb} onPress={() => setMicMin(v as number | null | "manual")} />
                      ))}
                    </View>
                    {micMin === "manual" && <TextInput value={micManual} onChangeText={setMicManual} keyboardType="number-pad" placeholder="Dakika" placeholderTextColor={C.dim2} style={styles.input} />}
                    <TextInput value={micReason} onChangeText={setMicReason} placeholder="Sebep (opsiyonel)" placeholderTextColor={C.dim2} style={styles.input} />
                    <Aksiyon tint="#FB7185" icon="micoff" label="Mikrofon Yasağı Ver" disabled={busy} onPress={doMicBan} />
                    <Txt size={9.5} color={C.dim2} lh={1.4}>Yasaklı kullanıcı odalara girip dinler ama yazamaz / mikrofona çıkamaz.</Txt>
                  </View></View>
                )}

                <Baslik>HESAP YASAĞI (UYGULAMA GENELİ)</Baslik>
                {d.hesapYasakli ? (
                  <View style={styles.group}><View style={styles.gRow}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="extrabold" size={12.5} color="#FB7185">Hesap yasaklı</Txt>
                      <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{d.hesapBitis ? `Bitiş: ${zaman(d.hesapBitis)}` : "Kalıcı"}{d.hesapSebep ? ` · ${d.hesapSebep}` : ""}</Txt>
                    </View>
                    <Aksiyon tint="#34D399" icon="check" label="Kaldır" disabled={busy} onPress={() => run(() => accountUnban(d.id), "Yasak kaldırıldı")} />
                  </View></View>
                ) : (
                  <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {BAN_CHIPS.map(([lb, v]) => (
                        <Secim key={lb} on={accMin === v} label={lb} tint="#FB7185" onPress={() => setAccMin(v as number | null | "manual")} />
                      ))}
                    </View>
                    {accMin === "manual" && <TextInput value={accManual} onChangeText={setAccManual} keyboardType="number-pad" placeholder="Dakika" placeholderTextColor={C.dim2} style={styles.input} />}
                    <TextInput value={accReason} onChangeText={setAccReason} placeholder="Sebep (kullanıcıya gösterilir)" placeholderTextColor={C.dim2} style={styles.input} />
                    <Aksiyon dolu tint="#E5484D" icon="ban" label="Hesabı Yasakla" disabled={busy} onPress={doAccBan} />
                    <Txt size={9.5} color={C.dim2} lh={1.4}>Yasaklı kullanıcı uygulamayı hiç kullanamaz; oturumu kapatılır ve girişte sebep + süreyle karşılaşır.</Txt>
                  </View></View>
                )}
              </>
            )}

            {/* ================= KİMLİK & BİLGİ ================= */}
            {section === "identity" && (
              <>
                {/* Ad + avatar: developer VE super_admin düzenleyebilir */}
                <Baslik>AD & AVATAR</Baslik>
                <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                    <Portrait name={d.name} size={54} photo={d.photo} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Aksiyon tint={C.gold2} icon="camera" label="Avatarı Değiştir" disabled={busy} onPress={doAvatar} />
                      {!!d.photo && (
                        <Aksiyon tint="#FB7185" icon="trash" label="Avatarı Kaldır" disabled={busy} onPress={() => run(() => updateUserIdentity(d.id, undefined, ""), "Avatar kaldırıldı")} />
                      )}
                    </View>
                  </View>
                  {/* Girdi ve kaydet alt alta: yan yanayken buton daralıp
                      dokunması zor bir şeride dönüşüyordu. */}
                  <View style={{ gap: 8 }}>
                    <TextInput value={newName} onChangeText={setNewName} placeholder={`Mevcut ad: ${d.name}`} placeholderTextColor={C.dim2} style={styles.input} />
                    <Aksiyon dolu tint={C.gold2} label="Adı Kaydet" disabled={busy || newName.trim().length < 2} onPress={() => run(() => updateUserIdentity(d.id, newName.trim()), "Ad değişti").then(() => setNewName(""))} />
                  </View>
                </View></View>

                {/* Bilgiler: e-posta (görüntüleme herkese) + kayıt tarihi */}
                <Baslik>BİLGİLER</Baslik>
                <View style={styles.group}>
                  <View style={{ padding: 12 }}>
                    <Txt weight="bold" size={10} color={C.dim2}>E-POSTA</Txt>
                    <Txt size={12.5} color={C.text} style={{ marginTop: 3 }}>{d.email || "—"}</Txt>
                  </View>
                  <View style={styles.divider} />
                  <View style={{ padding: 12 }}>
                    <Txt weight="bold" size={10} color={C.dim2}>KAYIT TARİHİ</Txt>
                    <Txt size={12.5} color={C.text} style={{ marginTop: 3 }}>{d.kayitTarihi ? zaman(d.kayitTarihi) : "—"}</Txt>
                  </View>
                </View>

                {/* Özel ID hakları: beta = kapsül, premium = premium kart. Yalnız yönetici verir. */}
                <Baslik tint={C.gold}>ÖZEL ID HAKLARI</Baslik>
                <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                  {([["beta_tester", "Beta Tester", "Kapsül ID (6-7 hane) hakkı"], ["premium_hak", "Premium Hak", "Premium ID (≤5 hane) hakkı"]] as const).map(([alan, baslik, alt]) => {
                    const acik = alan === "beta_tester" ? !!haklar?.beta_tester : !!haklar?.premium_hak;
                    return (
                      /* "Hak Var ✓" / "Hak Ver" bir butondu ama aslında
                         aç/kapa durumu; anahtara çevrildi. */
                      <View key={alan} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Txt weight="bold" size={12} color={C.text}>{baslik}</Txt>
                          <Txt size={10} color={acik ? "#6EE7B7" : C.dim} style={{ marginTop: 2 }}>{acik ? `Hak verildi · ${alt}` : alt}</Txt>
                        </View>
                        <Anahtar on={acik} disabled={busy || !haklar} onPress={() => run(() => setUserHak(d.id, alan, !acik), acik ? `${baslik} kaldırıldı` : `${baslik} verildi`)} />
                      </View>
                    );
                  })}
                  {haklar?.ozel_id && (
                    <Txt size={10} color={C.dim2}>Mevcut özel ID: {haklar.ozel_id} ({haklar.ozel_id_tip === "premium" ? "premium" : "kapsül"})</Txt>
                  )}
                </View></View>

                {isDev ? (
                  <>
                    {/* Rol: yalnızca developer */}
                    <Baslik tint={C.gold}>ROL (DEVELOPER)</Baslik>
                    <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {(["user", "developer", "super_admin"] as const).map((rl) => (
                          <Secim key={rl} on={d.rol === rl} label={ROLE_LABEL[rl]} disabled={busy || d.rol === rl} onPress={() => run(() => setPlatformRole(d.id, rl), "Rol güncellendi")} />
                        ))}
                      </View>
                    </View></View>

                    <Baslik tint={C.gold}>GELİŞTİRİCİ — KİMLİK BİLGİLERİ</Baslik>
                    <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>KULLANICI ID</Txt>
                        <View style={{ gap: 8 }}><TextInput value={newId} onChangeText={setNewId} placeholder={`Mevcut: ${d.publicId}`} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                          <Aksiyon dolu tint={C.gold2} label="Kaydet" disabled={busy || !newId.trim()} onPress={() => run(() => changePublicId(d.id, newId), "ID değişti").then(() => setNewId(""))} />
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>E-POSTA DÜZENLE</Txt>
                        <View style={{ gap: 8 }}><TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder={d.email || "yeni@eposta.com"} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                          <Aksiyon dolu tint={C.gold2} label="Kaydet" disabled={busy || !newEmail.includes("@")} onPress={() => run(() => changeEmail(d.id, newEmail), "E-posta değişti").then(() => setNewEmail(""))} />
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>ŞİFRE SIFIRLA</Txt>
                        <View style={{ gap: 8 }}>
                          <TextInput value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Yeni şifre (≥6)" placeholderTextColor={C.dim2} style={styles.input} />
                          {/* Şifre sıfırlama da geri alınamaz — onay ister */}
                          <Aksiyon
                            tint="#FB7185"
                            icon="lock"
                            label="Şifreyi Sıfırla"
                            disabled={busy || newPw.length < 6}
                            onPress={() => setOnay({
                              baslik: "Şifreyi sıfırla?",
                              metin: `${d.name} kullanıcısının şifresi değiştirilecek. Mevcut şifresiyle bir daha giriş yapamaz.`,
                              btn: "Sıfırla",
                              fn: () => run(() => resetPassword(d.id, newPw), "Şifre sıfırlandı").then(() => setNewPw("")),
                            })}
                          />
                        </View>
                      </View>
                    </View></View>
                  </>
                ) : (
                  <View style={[styles.group, styles.lockedInfo]}>
                    <Icon name="lock" size={14} color={C.dim2} />
                    <Txt size={11} color={C.dim} style={{ flex: 1 }} lh={1.4}>Rol atama, ID, e-posta düzenleme ve şifre sıfırlama yalnızca geliştirici (developer) yetkisindedir.</Txt>
                  </View>
                )}
              </>
            )}

            {/* ================= İŞLEM GEÇMİŞİ ================= */}
            {section === "history" && (
              <>
                <View style={styles.summary}>
                  <View style={styles.sumCol}><Txt weight="displayBold" size={16} color="#fff">{history?.length ?? 0}</Txt><Txt size={8.5} color={C.dim2}>işlem</Txt></View>
                  <View style={styles.sumDiv} />
                  <View style={styles.sumCol}><Txt weight="displayBold" size={16} color={C.gold2}>{history?.filter((h) => h.islem === "id_degistir").length ?? 0}</Txt><Txt size={8.5} color={C.dim2}>ID değişimi</Txt></View>
                  <View style={styles.sumDiv} />
                  <View style={styles.sumCol}><Txt weight="displayBold" size={16} color="#5EEAD4">{new Set((history ?? []).map((h) => h.actorId)).size}</Txt><Txt size={8.5} color={C.dim2}>yönetici</Txt></View>
                </View>

                <Baslik>UYGULANAN İŞLEMLER</Baslik>
                {history && history.length > 0 ? (
                  <View style={styles.group}>
                    {history.map((h, i) => (
                      <View key={h.id}>
                        {i > 0 && <View style={styles.divider} />}
                        <View style={styles.histRow}>
                          <View style={[styles.secIcon, { backgroundColor: "rgba(255,255,255,.05)" }]}><Icon name="clipboard" size={14} color={C.dim} /></View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Txt weight="bold" size={12.5} color={C.text}>{ISLEM_LABEL[h.islem] || h.islem}</Txt>
                            {!!h.detay && <Txt size={10.5} color={C.dim} lh={1.4} style={{ marginTop: 2 }}>{h.detay}</Txt>}
                            <Txt size={9.5} color={C.dim2} style={{ marginTop: 3 }}>
                              {h.actorName}{h.actorPublicId ? ` (${h.actorPublicId})` : ""}{h.actorRol ? ` · ${ROLE_LABEL[h.actorRol] || h.actorRol}` : ""} · {zaman(h.at)}
                            </Txt>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.lockedInfo}><Icon name="clipboard" size={14} color={C.dim2} /><Txt size={11.5} color={C.dim} style={{ flex: 1 }} lh={1.4}>Bu kullanıcıya henüz yönetici işlemi uygulanmamış.</Txt></View>
                )}
              </>
            )}
          </ScrollView>
        )}
        </KeyboardAware>
      </SafeAreaView>

      {/* Geri alınamaz işlemler için onay. Hesap yasağı tek dokunuşla
          çalışıyordu — kullanıcının oturumunu kapatan bir işlem için fazla
          kolaydı. */}
      <CenterModal visible={!!onay} onClose={() => setOnay(null)}>
        <View style={styles.onayKart}>
          <View style={styles.onayIkon}>
            <Icon name="warn" size={22} color="#FB7185" />
          </View>
          <Txt weight="displayBold" size={16} color="#fff" align="center" style={{ marginTop: 13 }}>{onay?.baslik}</Txt>
          <Txt size={12} color={C.dim} lh={1.55} align="center" style={{ marginTop: 9 }}>{onay?.metin}</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Pressable onPress={() => setOnay(null)} style={[styles.onayBtn, { backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" }]}>
              <Txt weight="bold" size={13} color={C.text}>Vazgeç</Txt>
            </Pressable>
            <Pressable
              onPress={() => { const o = onay; setOnay(null); haptic.heavy(); o?.fn(); }}
              style={[styles.onayBtn, { backgroundColor: "rgba(220,38,38,.9)" }]}
            >
              <Txt weight="extrabold" size={13} color="#FEE2E2">{onay?.btn}</Txt>
            </Pressable>
          </View>
        </View>
      </CenterModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  onayKart: { borderRadius: 24, padding: 22, alignItems: "center", backgroundColor: "#181620", borderWidth: 1, borderColor: "rgba(251,113,133,.28)" },
  onayIkon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,113,133,.14)", borderWidth: 1, borderColor: "rgba(251,113,133,.34)" },
  onayBtn: { flex: 1, paddingVertical: 13, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  // Seçim çipi: bir seçeneği işaretler, tek başına bir şey yapmaz.
  secim: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.10)" },
  // Aksiyon butonu: basınca iş yapar. Seçimden ayrılsın diye köşeli ve dolgun.
  aksiyon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 13, borderWidth: 1.5 },
  anahtar: { width: 44, height: 25, borderRadius: 999, padding: 2.5, justifyContent: "center" },
  anahtarTopuz: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  uyariRozet: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(251,113,133,.14)", borderWidth: 1, borderColor: "rgba(251,113,133,.34)" },
  bakiyeKutu: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14 },
  dikeyAyirici: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.12)" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  chip: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)", justifyContent: "center" },
  note: { marginBottom: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33` },
  lbl: { letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: C.text, fontSize: 13, fontFamily: "PlusJakartaSans_500Medium" },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: "rgba(251,113,133,.1)", borderWidth: 1, borderColor: "rgba(251,113,133,.3)" },
  gRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  freezeRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, paddingHorizontal: 13 },
  summary: { flexDirection: "row", borderRadius: 16, backgroundColor: "rgba(255,255,255,.04)", borderWidth: 1, borderColor: C.line, paddingVertical: 12 },
  sumCol: { flex: 1, alignItems: "center", gap: 3 },
  sumDiv: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  secIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  histRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, paddingHorizontal: 13 },
  lockedInfo: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,.03)", borderWidth: 1, borderColor: C.line, marginTop: 8 },
});
