import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CoinBadge, DiamondBadge } from "@/components/Coins";
import { KeyboardAware } from "@/components/KeyboardAware";
import { Portrait } from "@/components/Portrait";
import { Txt } from "@/components/Txt";
import {
  accountBan, accountUnban, changeEmail, changePublicId, freezeAsset, getActionHistory,
  getUserDetail, getUserHaklar, grantBalance, micBan, micUnban, resetPassword, setPlatformRole,
  setUserHak, updateUserIdentity,
  type AdminAction, type AdminUserDetail,
} from "@/data/remote/adminRepo";
import { uploadAvatar } from "@/data/remote/storageRepo";
import { Icon } from "@/icons/Icon";
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

const BAN_CHIPS = [["30dk", 30], ["1s", 60], ["1g", 1440], ["7g", 10080], ["Kalıcı", null], ["Manuel", "manual"]] as const;

export default function AdminUserEdit() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; section?: string }>();
  const userId = params.userId ? parseInt(String(params.userId), 10) : NaN;
  const section = String(params.section || "economy");
  const myRole = useApp((s) => s.role);
  const isDev = myRole === "developer";

  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [haklar, setHaklar] = useState<{ beta_tester: boolean; premium_hak: boolean; ozel_id: string | null; ozel_id_tip: string | null } | null>(null);
  const [history, setHistory] = useState<AdminAction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
    run(() => accountBan(d.id, accReason.trim() || null, mins as number | null), "Hesap yasaklandı").then(() => setAccReason(""));
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
      <Gradient colors={["#241B0A", "#08080C"]} deg={170} locations={[0, 0.5]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAware>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}><Icon name="back" size={16} color={C.text} /></Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight="displayBold" size={16} color="#fff" numberOfLines={1}>{SECTION_TITLE[section] || "Düzenle"}</Txt>
            {d && <Txt size={10.5} color={C.dim} numberOfLines={1}>{d.name} · ID: {d.publicId}</Txt>}
          </View>
        </View>

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
                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BAKİYE VER / AL</Txt>
                <View style={styles.group}>
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["elmas", "altin"] as const).map((a) => (
                        <Pressable key={a} onPress={() => setAsset(a)} style={[styles.chip, { flexDirection: "row", gap: 5 }, asset === a && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                          {a === "elmas" ? <DiamondBadge size={13} /> : <CoinBadge size={13} />}
                          <Txt weight="bold" size={10.5} color={asset === a ? C.gold2 : C.dim}>{a === "elmas" ? "Elmas" : "Altın"}</Txt>
                        </Pressable>
                      ))}
                      <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Miktar" placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable disabled={busy} onPress={() => doGrant(1)} style={[styles.actBtn, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}>
                        <Icon name="plus" size={13} sw={2.5} color={C.green} /><Txt weight="extrabold" size={12} color={C.green}>Ver</Txt>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => doGrant(-1)} style={[styles.actBtn, { backgroundColor: "rgba(251,113,133,.1)", borderColor: "rgba(251,113,133,.3)" }]}>
                        <Icon name="x" size={13} color="#FB7185" /><Txt weight="extrabold" size={12} color="#FB7185">Al</Txt>
                      </Pressable>
                    </View>
                    <Txt size={9.5} color={C.dim2} lh={1.4}>Güncel: {d.elmas.toLocaleString("tr-TR")} elmas · {d.altin.toLocaleString("tr-TR")} altın</Txt>
                  </View>
                </View>

                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>DONDURMA (HARCAMA KİLİDİ)</Txt>
                <View style={styles.group}>
                  {([["elmas", d.elmasDondu], ["altin", d.altinDondu]] as const).map(([a, frozen], i) => (
                    <View key={a}>
                      {i > 0 && <View style={styles.divider} />}
                      <View style={styles.freezeRow}>
                        {a === "elmas" ? <DiamondBadge size={16} /> : <CoinBadge size={16} />}
                        <View style={{ flex: 1 }}>
                          <Txt weight="bold" size={12.5} color={C.text}>{a === "elmas" ? "Elmas" : "Altın"}</Txt>
                          <Txt size={10} color={frozen ? "#FB7185" : C.dim} style={{ marginTop: 1 }}>{frozen ? "Donduruldu — harcayamaz" : "Serbest"}</Txt>
                        </View>
                        <Pressable disabled={busy} onPress={() => run(() => freezeAsset(d.id, a, !frozen), frozen ? "Çözüldü" : "Donduruldu")}
                          style={[styles.chip, frozen ? { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` } : { backgroundColor: "rgba(125,211,252,.12)", borderColor: "rgba(125,211,252,.32)" }]}>
                          <Icon name={frozen ? "unlock" : "lock"} size={12} color={frozen ? C.green : "#7DD3FC"} />
                          <Txt weight="bold" size={10.5} color={frozen ? C.green : "#7DD3FC"} style={{ marginLeft: 4 }}>{frozen ? "Çöz" : "Dondur"}</Txt>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ================= CEZAİ İŞLEMLER ================= */}
            {section === "penalty" && (
              <>
                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>MİKROFON YASAĞI</Txt>
                {d.micBanned ? (
                  <View style={styles.group}><View style={styles.gRow}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="extrabold" size={12.5} color="#FB7185">Mikrofon yasaklı</Txt>
                      <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{d.micBitis ? `Bitiş: ${zaman(d.micBitis)}` : "Kalıcı"}{d.micSebep ? ` · ${d.micSebep}` : ""}</Txt>
                    </View>
                    <Pressable disabled={busy} onPress={() => run(() => micUnban(d.id), "Yasak kaldırıldı")} style={[styles.chip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}><Txt weight="bold" size={10.5} color={C.green}>Kaldır</Txt></Pressable>
                  </View></View>
                ) : (
                  <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {BAN_CHIPS.map(([lb, v]) => (
                        <Pressable key={lb} onPress={() => setMicMin(v as number | null | "manual")} style={[styles.chip, micMin === v && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}><Txt weight="bold" size={10.5} color={micMin === v ? C.gold2 : C.dim}>{lb}</Txt></Pressable>
                      ))}
                    </View>
                    {micMin === "manual" && <TextInput value={micManual} onChangeText={setMicManual} keyboardType="number-pad" placeholder="Dakika" placeholderTextColor={C.dim2} style={styles.input} />}
                    <TextInput value={micReason} onChangeText={setMicReason} placeholder="Sebep (opsiyonel)" placeholderTextColor={C.dim2} style={styles.input} />
                    <Pressable disabled={busy} onPress={doMicBan} style={styles.dangerBtn}><Icon name="micoff" size={14} color="#FB7185" /><Txt weight="extrabold" size={12} color="#FB7185">Mikrofon Yasağı Ver</Txt></Pressable>
                    <Txt size={9.5} color={C.dim2} lh={1.4}>Yasaklı kullanıcı odalara girip dinler ama yazamaz / mikrofona çıkamaz.</Txt>
                  </View></View>
                )}

                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>HESAP YASAĞI (UYGULAMA GENELİ)</Txt>
                {d.hesapYasakli ? (
                  <View style={styles.group}><View style={styles.gRow}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="extrabold" size={12.5} color="#FB7185">Hesap yasaklı</Txt>
                      <Txt size={10.5} color={C.dim} style={{ marginTop: 2 }}>{d.hesapBitis ? `Bitiş: ${zaman(d.hesapBitis)}` : "Kalıcı"}{d.hesapSebep ? ` · ${d.hesapSebep}` : ""}</Txt>
                    </View>
                    <Pressable disabled={busy} onPress={() => run(() => accountUnban(d.id), "Yasak kaldırıldı")} style={[styles.chip, { backgroundColor: `${C.green}14`, borderColor: `${C.green}44` }]}><Txt weight="bold" size={10.5} color={C.green}>Kaldır</Txt></Pressable>
                  </View></View>
                ) : (
                  <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {BAN_CHIPS.map(([lb, v]) => (
                        <Pressable key={lb} onPress={() => setAccMin(v as number | null | "manual")} style={[styles.chip, accMin === v && { backgroundColor: "rgba(251,113,133,.12)", borderColor: "rgba(251,113,133,.34)" }]}><Txt weight="bold" size={10.5} color={accMin === v ? "#FB7185" : C.dim}>{lb}</Txt></Pressable>
                      ))}
                    </View>
                    {accMin === "manual" && <TextInput value={accManual} onChangeText={setAccManual} keyboardType="number-pad" placeholder="Dakika" placeholderTextColor={C.dim2} style={styles.input} />}
                    <TextInput value={accReason} onChangeText={setAccReason} placeholder="Sebep (kullanıcıya gösterilir)" placeholderTextColor={C.dim2} style={styles.input} />
                    <Pressable disabled={busy} onPress={doAccBan} style={styles.dangerBtn}><Icon name="ban" size={14} color="#FB7185" /><Txt weight="extrabold" size={12} color="#FB7185">Hesabı Yasakla</Txt></Pressable>
                    <Txt size={9.5} color={C.dim2} lh={1.4}>Yasaklı kullanıcı uygulamayı hiç kullanamaz; oturumu kapatılır ve girişte sebep + süreyle karşılaşır.</Txt>
                  </View></View>
                )}
              </>
            )}

            {/* ================= KİMLİK & BİLGİ ================= */}
            {section === "identity" && (
              <>
                {/* Ad + avatar: developer VE super_admin düzenleyebilir */}
                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>AD & AVATAR</Txt>
                <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Portrait name={d.name} size={48} photo={d.photo} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Pressable disabled={busy} onPress={doAvatar} style={[styles.chip, { alignSelf: "flex-start" }]}>
                        <Icon name="camera" size={12} color={C.gold2} /><Txt weight="bold" size={10.5} color={C.gold2} style={{ marginLeft: 5 }}>Avatarı Değiştir</Txt>
                      </Pressable>
                      {!!d.photo && (
                        <Pressable disabled={busy} onPress={() => run(() => updateUserIdentity(d.id, undefined, ""), "Avatar kaldırıldı")} style={[styles.chip, { alignSelf: "flex-start" }]}>
                          <Icon name="trash" size={12} color="#FB7185" /><Txt weight="bold" size={10.5} color="#FB7185" style={{ marginLeft: 5 }}>Avatarı Kaldır</Txt>
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput value={newName} onChangeText={setNewName} placeholder={`Mevcut ad: ${d.name}`} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                    <Pressable disabled={busy || newName.trim().length < 2} onPress={() => run(() => updateUserIdentity(d.id, newName.trim()), "Ad değişti").then(() => setNewName(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newName.trim().length >= 2 ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt></Pressable>
                  </View>
                </View></View>

                {/* Bilgiler: e-posta (görüntüleme herkese) + kayıt tarihi */}
                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>BİLGİLER</Txt>
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
                <Txt weight="bold" size={10.5} color={C.gold} style={styles.lbl}>ÖZEL ID HAKLARI</Txt>
                <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                  {([["beta_tester", "Beta Tester", "Kapsül ID (6-7 hane) hakkı"], ["premium_hak", "Premium Hak", "Premium ID (≤5 hane) hakkı"]] as const).map(([alan, baslik, alt]) => {
                    const acik = alan === "beta_tester" ? !!haklar?.beta_tester : !!haklar?.premium_hak;
                    return (
                      <View key={alan} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Txt weight="bold" size={12} color={C.text}>{baslik}</Txt>
                          <Txt size={10} color={C.dim} style={{ marginTop: 2 }}>{alt}</Txt>
                        </View>
                        <Pressable disabled={busy || !haklar} onPress={() => run(() => setUserHak(d.id, alan, !acik), acik ? `${baslik} kaldırıldı` : `${baslik} verildi`)} style={[styles.chip, acik && { backgroundColor: `${C.green}18`, borderColor: `${C.green}55` }]}>
                          <Txt weight="extrabold" size={10.5} color={acik ? "#6EE7B7" : C.dim}>{acik ? "Hak Var ✓" : "Hak Ver"}</Txt>
                        </Pressable>
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
                    <Txt weight="bold" size={10.5} color={C.gold} style={styles.lbl}>ROL (DEVELOPER)</Txt>
                    <View style={styles.group}><View style={{ padding: 12, gap: 8 }}>
                      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                        {(["user", "developer", "super_admin"] as const).map((rl) => (
                          <Pressable key={rl} disabled={busy || d.rol === rl} onPress={() => run(() => setPlatformRole(d.id, rl), "Rol güncellendi")} style={[styles.chip, d.rol === rl && { backgroundColor: `${C.gold}14`, borderColor: `${C.gold}44` }]}>
                            <Txt weight="bold" size={10.5} color={d.rol === rl ? C.gold2 : C.dim}>{ROLE_LABEL[rl]}</Txt>
                          </Pressable>
                        ))}
                      </View>
                    </View></View>

                    <Txt weight="bold" size={10.5} color={C.gold} style={styles.lbl}>GELİŞTİRİCİ — KİMLİK BİLGİLERİ</Txt>
                    <View style={styles.group}><View style={{ padding: 12, gap: 10 }}>
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>KULLANICI ID</Txt>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput value={newId} onChangeText={setNewId} placeholder={`Mevcut: ${d.publicId}`} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                          <Pressable disabled={busy || !newId.trim()} onPress={() => run(() => changePublicId(d.id, newId), "ID değişti").then(() => setNewId(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newId.trim() ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt></Pressable>
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>E-POSTA DÜZENLE</Txt>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder={d.email || "yeni@eposta.com"} placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                          <Pressable disabled={busy || !newEmail.includes("@")} onPress={() => run(() => changeEmail(d.id, newEmail), "E-posta değişti").then(() => setNewEmail(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newEmail.includes("@") ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Kaydet</Txt></Pressable>
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={{ gap: 6 }}>
                        <Txt weight="bold" size={10} color={C.dim2}>ŞİFRE SIFIRLA</Txt>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="Yeni şifre (≥6)" placeholderTextColor={C.dim2} style={[styles.input, { flex: 1 }]} />
                          <Pressable disabled={busy || newPw.length < 6} onPress={() => run(() => resetPassword(d.id, newPw), "Şifre sıfırlandı").then(() => setNewPw(""))} style={[styles.actBtn, { flex: 0, paddingHorizontal: 16, opacity: newPw.length >= 6 ? 1 : 0.4 }]}><Txt weight="extrabold" size={12} color={C.gold2}>Sıfırla</Txt></Pressable>
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

                <Txt weight="bold" size={10.5} color={C.dim} style={styles.lbl}>UYGULANAN İŞLEMLER</Txt>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  group: { borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
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
